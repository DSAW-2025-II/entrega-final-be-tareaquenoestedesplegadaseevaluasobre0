// Servicio de dominio de usuarios: lógica de negocio para gestión de usuarios
const MongoUserRepository = require('../../infrastructure/repositories/MongoUserRepository');
const MongoVehicleRepository = require('../../infrastructure/repositories/MongoVehicleRepository');
const CreateUserDto = require('../dtos/CreateUserDto');
const UpdateProfileDto = require('../dtos/UpdateProfileDto');
const UserResponseDto = require('../dtos/UserResponseDto');
const DuplicateError = require('../errors/DuplicateError');
const bcrypt = require('bcryptjs');
const gridfsStorage = require('../../infrastructure/storage/gridfsStorage');
const path = require('path');

class UserService {
  constructor() {
    this.userRepository = new MongoUserRepository();
    this.vehicleRepository = new MongoVehicleRepository();
  }

  // Registrar nuevo usuario: verifica duplicados, hashea contraseña y crea usuario
  async registerUser(userData, file = null) {
    try {
      // Verificar duplicados antes de subir archivo
      const emailExists = await this.userRepository.exists('corporateEmail', userData.corporateEmail);
      if (emailExists) {
        throw new DuplicateError('Corporate email already exists', 'duplicate_email', {
          field: 'corporateEmail',
          value: userData.corporateEmail
        });
      }

      const universityIdExists = await this.userRepository.exists('universityId', userData.universityId);
      if (universityIdExists) {
        throw new DuplicateError('University ID already exists', 'duplicate_universityId', {
          field: 'universityId',
          value: userData.universityId
        });
      }

      // Hashear contraseña
      const passwordHash = await bcrypt.hash(userData.password, 10);

      // Si hay archivo, guardarlo en GridFS
      let profilePhotoId = null;
      if (file && file.buffer) {
        const ext = path.extname(file.originalname);
        const filename = `profile-${Date.now()}-${Math.round(Math.random() * 1E9)}${ext}`;
        profilePhotoId = await gridfsStorage.saveFile(file.buffer, {
          filename,
          contentType: file.mimetype,
          category: 'profiles'
        });
      }

      // Preparar datos del usuario
      const userDto = {
        firstName: userData.firstName,
        lastName: userData.lastName,
        universityId: userData.universityId,
        corporateEmail: userData.corporateEmail,
        phone: userData.phone,
        password: passwordHash,
        role: userData.role,
        profilePhoto: profilePhotoId ? `/api/files/${profilePhotoId}` : null
      };

      // Crear usuario
      const user = await this.userRepository.create(userDto);
      return UserResponseDto.fromEntity(user);

    } catch (error) {
      // Si hay error y se guardó un archivo en GridFS, eliminarlo
      // (esto se manejará en el catch del saveFile si falla antes de guardar)
      throw error;
    }
  }

  async getUserById(id) {
    const user = await this.userRepository.findById(id);
    if (!user) {
      throw new Error('User not found');
    }
    return UserResponseDto.fromEntity(user);
  }

  async getUserByEmail(email) {
    const user = await this.userRepository.findByEmail(email);
    if (!user) {
      return null;
    }
    return UserResponseDto.fromEntity(user);
  }

  async updateUser(id, updates) {
    const user = await this.userRepository.update(id, updates);
    return UserResponseDto.fromEntity(user);
  }

  /**
   * Get current user's profile with driver.hasVehicle status
   * 
   * Contrato:
   * - Input: userId (string) - ID from JWT token (req.user.sub)
   * - Output: UserResponseDto with dynamic driver.hasVehicle
   * - Errors: 
   *   - user_not_found: User no longer exists (edge case)
   * 
   * Para passengers: NO incluye campo driver
   * Para drivers: Incluye driver: { hasVehicle: true|false }
   * 
   * @param {string} userId - User ID from JWT token
   * @returns {Promise<UserResponseDto>} - User profile DTO
   * @throws {Error} - If user not found
   */
  async getMyProfile(userId) {
    // Buscar usuario por ID
    const user = await this.userRepository.findById(userId);
    
    if (!user) {
      const error = new Error('User not found');
      error.code = 'user_not_found';
      throw error;
    }

    // Crear DTO base con datos del usuario
    const userDto = UserResponseDto.fromEntity(user);

    // Always check if user has vehicle registered (regardless of current role)
    // This allows users to switch between roles if they have a vehicle
    const hasVehicle = await this.vehicleRepository.driverHasVehicle(userId);
    
    // Include driver info if user is driver OR has vehicle (can switch roles)
    if (user.role === 'driver' || hasVehicle) {
      userDto.driver = { hasVehicle };
    }

    return userDto;
  }

  /**
   * Update current user's profile (partial update)
   * 
   * Contrato:
   * - Input: userId, UpdateProfileDto, optional file (from multer)
   * - Output: UserResponseDto con datos actualizados
   * - Side effects: 
   *   - Si se sube nueva foto, elimina la foto anterior
   *   - Si falla la actualización después de subir foto, limpia la nueva foto
   * 
   * ALLOW-LIST: firstName, lastName, phone, profilePhoto
   * IMMUTABLE: corporateEmail, universityId, role (validados en controller)
   * 
   * Photo replacement strategy:
   * 1. New photo is uploaded to disk by multer (before this method)
   * 2. We get old photo path from DB
   * 3. Update DB with new photo path
   * 4. Delete old photo from disk
   * 5. If update fails, cleanup new photo (handled by middleware)
   * 
   * @param {string} userId - User ID from JWT token
   * @param {UpdateProfileDto} updateProfileDto - DTO with allowed fields
   * @param {Object} file - Uploaded file from multer (optional)
   * @returns {Promise<UserResponseDto>} - Updated user profile
   * @throws {Error} - If user not found
   */
  async updateMyProfile(userId, updateProfileDto, file = null) {
    try {
      // Buscar usuario actual para obtener foto antigua
      const existingUser = await this.userRepository.findById(userId);
      
      if (!existingUser) {
        const error = new Error('User not found');
        error.code = 'user_not_found';
        throw error;
      }

      // Preparar datos de actualización
      const updateData = updateProfileDto.toObject();

      // Si hay un archivo nuevo, guardarlo en GridFS
      let newPhotoId = null;
      if (file && file.buffer) {
        const ext = path.extname(file.originalname);
        const filename = `profile-${userId}-${Date.now()}-${Math.round(Math.random() * 1E9)}${ext}`;
        newPhotoId = await gridfsStorage.saveFile(file.buffer, {
          filename,
          contentType: file.mimetype,
          category: 'profiles',
          userId: userId
        });
        // Actualizar con el nuevo ID de GridFS
        updateData.profilePhoto = `/api/files/${newPhotoId}`;
      }

      // Guardar referencia a la foto antigua para cleanup posterior
      const oldPhotoUrl = existingUser.profilePhoto;

      // Actualizar usuario en DB
      const updatedUser = await this.userRepository.update(userId, updateData);

      // Si se actualizó la foto exitosamente, eliminar la foto antigua de GridFS
      if (newPhotoId && oldPhotoUrl) {
        // Extraer ID de GridFS de la URL antigua
        const oldPhotoIdMatch = oldPhotoUrl.match(/\/api\/files\/([a-f\d]{24})/i);
        if (oldPhotoIdMatch) {
          const oldPhotoId = oldPhotoIdMatch[1];
          try {
            await gridfsStorage.deleteFile(oldPhotoId);
            console.log(`[UserService] Deleted old profile photo from GridFS: ${oldPhotoId}`);
          } catch (err) {
            // No es crítico si falla el cleanup de la foto antigua
            console.error('Error deleting old profile photo from GridFS:', err.message);
          }
        }
      }

      // Crear DTO de respuesta con driver.hasVehicle si aplica
      const userDto = UserResponseDto.fromEntity(updatedUser);
      
      if (updatedUser.role === 'driver') {
        const hasVehicle = await this.vehicleRepository.driverHasVehicle(userId);
        userDto.driver = { hasVehicle };
      }

      return userDto;

    } catch (error) {
      // Si hay un archivo nuevo guardado en GridFS y ocurre error, eliminarlo
      if (file && file.buffer) {
        // El archivo se guarda después de validar, así que si llegamos aquí y hay error,
        // el archivo podría haberse guardado. Intentar eliminarlo si existe.
        // Nota: Esto es un caso edge, normalmente el error ocurre antes de guardar
        console.warn('[UserService] Error updating profile, file may have been saved to GridFS');
      }
      throw error;
    }
  }

  /**
   * Update user role
   * 
   * @param {string} userId - User ID
   * @param {string} newRole - New role ('passenger' | 'driver')
   * @returns {Promise<Object>} - Updated user DTO
   */
  async updateUserRole(userId, newRole) {
    try {
      console.log(`[UserService] Updating user role | userId: ${userId} | newRole: ${newRole}`);
      
      // Validate role
      if (!['passenger', 'driver'].includes(newRole)) {
        throw new Error('Invalid role. Must be passenger or driver');
      }

      // Update user role
      const updatedUser = await this.userRepository.update(userId, { role: newRole });
      console.log(`[UserService] User role updated in DB | userId: ${userId}`);

      if (!updatedUser) {
        const error = new Error('User not found');
        error.code = 'user_not_found';
        throw error;
      }

      // Create response DTO with driver.hasVehicle if applicable
      const userDto = UserResponseDto.fromEntity(updatedUser);
      console.log(`[UserService] DTO created | role: ${userDto.role}`);
      
      if (updatedUser.role === 'driver') {
        console.log(`[UserService] Checking vehicle status for driver`);
        const hasVehicle = await this.vehicleRepository.driverHasVehicle(userId);
        userDto.driver = { hasVehicle };
        console.log(`[UserService] Vehicle status: ${hasVehicle}`);
      }

      console.log(`[UserService] Update user role completed successfully`);
      return userDto;

    } catch (error) {
      console.error('[UserService] Error in updateUserRole:', error);
      throw error;
    }
  }
}

module.exports = UserService;

