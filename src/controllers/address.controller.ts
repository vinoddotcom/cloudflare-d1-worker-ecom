import { AuthRequest } from '../middleware/auth';
import { errorResponse, successResponse } from '../utils/response';
import { Address } from '../models/user.model';
import { AddressRepository } from '../data/repositories/address.repository';
import { Env } from '../models/common.model';
import { AddressCreateInput, AddressUpdateInput } from '../models/address.model';

/**
 * Controller for address-related operations
 */
export class AddressController {
    private addressRepository: AddressRepository;

    constructor(private env: Env) {
        this.addressRepository = new AddressRepository(env.DB);
    }

    /**
     * Get all addresses for the current user
     */
    async getUserAddresses(request: AuthRequest): Promise<Response> {
        try {
            const addresses = await this.addressRepository.getByUserId(request.userId || '');
            return successResponse(addresses);
        } catch (error) {
            console.error('Error fetching user addresses:', error);
            return errorResponse(error instanceof Error ? error.message : 'Failed to fetch addresses', 500);
        }
    }

    /**
     * Get a specific address by ID
     */
    async getAddressById(request: AuthRequest): Promise<Response> {
        try {
            const id = request.params?.id;
            if (!id) {
                return errorResponse('Address ID is required', 400);
            }

            const addressId = parseInt(id);
            if (isNaN(addressId)) {
                return errorResponse('Invalid address ID', 400);
            }

            const address = await this.addressRepository.getByIdAndUserId(addressId, request.userId || '');

            if (!address) {
                return errorResponse('Address not found', 404);
            }

            return successResponse(address);
        } catch (error) {
            console.error('Error fetching address:', error);
            return errorResponse(error instanceof Error ? error.message : 'Failed to fetch address', 500);
        }
    }

    /**
     * Create a new address
     */
    async createAddress(request: AuthRequest): Promise<Response> {
        try {
            const data = (request as AuthRequest & { validatedBody: AddressCreateInput }).validatedBody;
            const userId = request.userId || '';

            // If is_default is true, update existing default addresses
            if (data.is_default) {
                await this.addressRepository.updateDefaultStatus(userId, data.address_type);
            }

            const now = Date.now();

            // Create address using repository
            const addressData = {
                user_id: userId,
                address_type: data.address_type,
                is_default: data.is_default || false,
                name: data.name || undefined,
                phone: data.phone || undefined,
                address_line1: data.address_line1,
                address_line2: data.address_line2 || undefined,
                landmark: data.landmark || undefined,
                city: data.city,
                state: data.state,
                postal_code: data.postal_code,
                country: data.country,
                created_at: now,
                updated_at: now
            };

            const newAddressId = await this.addressRepository.create(addressData);

            // Get the newly created address
            const newAddress = await this.addressRepository.findById(newAddressId);

            return successResponse({
                message: 'Address created successfully',
                address: newAddress
            }, 201);
        } catch (error) {
            return errorResponse(error instanceof Error ? error.message : 'Failed to create address', 500);
        }
    }

    /**
     * Update an existing address
     */
    async updateAddress(request: AuthRequest): Promise<Response> {
        try {
            const id = request.params?.id;
            if (!id) {
                return errorResponse('Address ID is required', 400);
            }

            const addressId = parseInt(id);
            if (isNaN(addressId)) {
                return errorResponse('Invalid address ID', 400);
            }

            // Check if address exists and belongs to user
            const existingAddress = await this.addressRepository.getByIdAndUserId(addressId, request.userId || '');

            if (!existingAddress) {
                return errorResponse('Address not found or you do not have permission to update it', 404);
            }

            const data = (request as AuthRequest & { validatedBody: AddressUpdateInput }).validatedBody;

            // If is_default is true, update existing default addresses
            if (data.is_default) {
                const addressType = data.address_type || existingAddress.address_type;
                await this.addressRepository.updateDefaultStatus(request.userId || '', addressType);
            }

            // Prepare update data
            const updateData: Partial<Address> = {};

            // Only include fields that are provided
            if (data.address_type !== undefined) updateData.address_type = data.address_type;
            if (data.is_default !== undefined) updateData.is_default = data.is_default;
            if (data.name !== undefined) updateData.name = data.name;
            if (data.phone !== undefined) updateData.phone = data.phone;
            if (data.address_line1 !== undefined) updateData.address_line1 = data.address_line1;
            if (data.address_line2 !== undefined) updateData.address_line2 = data.address_line2;
            if (data.landmark !== undefined) updateData.landmark = data.landmark;
            if (data.city !== undefined) updateData.city = data.city;
            if (data.state !== undefined) updateData.state = data.state;
            if (data.postal_code !== undefined) updateData.postal_code = data.postal_code;
            if (data.country !== undefined) updateData.country = data.country;

            // Add updated timestamp
            updateData.updated_at = Date.now();

            // Execute update
            const success = await this.addressRepository.updateForUser(addressId, request.userId || '', updateData);

            if (!success) {
                return errorResponse('Failed to update address', 500);
            }

            // Get the updated address
            const updatedAddress = await this.addressRepository.findById(addressId);

            return successResponse({
                message: 'Address updated successfully',
                address: updatedAddress
            });
        } catch (error) {
            return errorResponse(error instanceof Error ? error.message : 'Failed to update address', 500);
        }
    }

    /**
     * Delete an address
     */
    async deleteAddress(request: AuthRequest): Promise<Response> {
        try {
            const id = request.params?.id;
            if (!id) {
                return errorResponse('Address ID is required', 400);
            }

            const addressId = parseInt(id);
            if (isNaN(addressId)) {
                return errorResponse('Invalid address ID', 400);
            }

            // Check if address exists and belongs to user
            const existingAddress = await this.addressRepository.getByIdAndUserId(addressId, request.userId || '');

            if (!existingAddress) {
                return errorResponse('Address not found or you do not have permission to delete it', 404);
            }

            // Check if it's the only address for the user
            const addressCount = await this.addressRepository.countByUserId(request.userId || '');

            if (addressCount <= 1) {
                return errorResponse('Cannot delete the only address. Please add another address first', 400);
            }

            // Delete the address
            const success = await this.addressRepository.deleteForUser(addressId, request.userId || '');

            if (!success) {
                return errorResponse('Failed to delete address', 500);
            }

            // If it was a default address, set another address as default
            if (existingAddress.is_default) {
                // Find another address of the same type
                const addresses = await this.addressRepository.getByUserId(request.userId || '');
                const sameTypeAddress = addresses.find(addr =>
                    addr.id !== addressId && (addr.address_type === existingAddress.address_type || addr.address_type === 'both')
                );

                if (sameTypeAddress) {
                    await this.addressRepository.setDefault(Number(sameTypeAddress.id), request.userId || '');
                }
            }

            return successResponse({
                message: 'Address deleted successfully'
            });
        } catch (error) {
            console.error('Error deleting address:', error);
            return errorResponse(error instanceof Error ? error.message : 'Failed to delete address', 500);
        }
    }

    /**
     * Get default shipping or billing address
     */
    async getDefaultAddress(request: AuthRequest): Promise<Response> {
        try {
            const type = request.params?.type;
            if (!type || !['shipping', 'billing', 'both'].includes(type)) {
                return errorResponse('Invalid address type. Must be shipping, billing, or both', 400);
            }

            // Get default address of specified type
            const address = await this.addressRepository.getDefaultByType(request.userId || '', type);

            if (!address) {
                // If no default address, get the most recently created address of the specified type
                const fallbackAddress = await this.addressRepository.getMostRecentByType(request.userId || '', type);

                if (!fallbackAddress) {
                    return errorResponse(`No ${type} address found for this user`, 404);
                }

                return successResponse({
                    ...fallbackAddress,
                    is_default: false,
                    note: `No default ${type} address found. Showing most recent ${type} address.`
                });
            }

            return successResponse(address);
        } catch (error) {
            console.error('Error fetching default address:', error);
            return errorResponse(error instanceof Error ? error.message : 'Failed to fetch default address', 500);
        }
    }

    /**
     * Set an address as default
     */
    async setDefaultAddress(request: AuthRequest): Promise<Response> {
        try {
            const id = request.params?.id;
            if (!id) {
                return errorResponse('Address ID is required', 400);
            }

            const addressId = parseInt(id);
            if (isNaN(addressId)) {
                return errorResponse('Invalid address ID', 400);
            }

            // Check if address exists and belongs to user
            const existingAddress = await this.addressRepository.getByIdAndUserId(addressId, request.userId || '');

            if (!existingAddress) {
                return errorResponse('Address not found or you do not have permission to modify it', 404);
            }

            // Update existing default addresses
            await this.addressRepository.updateDefaultStatus(request.userId || '', existingAddress.address_type);

            // Set this address as default
            const success = await this.addressRepository.setDefault(addressId, request.userId || '');

            if (!success) {
                return errorResponse('Failed to set address as default', 500);
            }

            return successResponse({
                message: 'Address set as default successfully'
            });
        } catch (error) {
            console.error('Error setting default address:', error);
            return errorResponse(error instanceof Error ? error.message : 'Failed to set default address', 500);
        }
    }
}