import { IRequest } from 'itty-router';
import { Env } from '../models/common.model';
import { AuthRequest } from '../middleware/auth';
import { ProductAttributeRepository } from '../data/repositories/product-attribute.repository';
import { successResponse, errorResponse } from '../utils/response';
import { validateInput } from '../utils/input-validation';

/**
 * Controller for product attribute operations
 */
export class ProductAttributeController {
    private attributeRepository: ProductAttributeRepository;

    constructor(env: Env) {
        this.attributeRepository = new ProductAttributeRepository(env);
    }

    /**
     * Get all product attributes
     * @param request Request object
     * @returns Response with list of product attributes
     */
    async getAllAttributes(request: AuthRequest): Promise<Response> {
        try {
            const attributes = await this.attributeRepository.findAllAttributes();

            return successResponse({
                attributes
            });
        } catch (error) {
            console.error('Error getting product attributes:', error);
            return errorResponse('Failed to get product attributes', 500);
        }
    }

    /**
     * Get a product attribute by ID
     * @param request Request object
     * @returns Response with product attribute details
     */
    async getAttribute(request: AuthRequest): Promise<Response> {
        try {
            const attributeId = parseInt(request.params?.id || '');
            if (isNaN(attributeId)) {
                return errorResponse('Invalid attribute ID', 400);
            }

            const attribute = await this.attributeRepository.findAttributeById(attributeId);
            if (!attribute) {
                return errorResponse('Attribute not found', 404);
            }

            // Get attribute values
            const values = await this.attributeRepository.findAttributeValues(attributeId);

            return successResponse({
                attribute,
                values
            });
        } catch (error) {
            console.error('Error getting product attribute:', error);
            return errorResponse('Failed to get product attribute', 500);
        }
    }

    /**
     * Create a new product attribute
     * @param request Request object
     * @returns Response with created attribute
     */
    async createAttribute(request: AuthRequest): Promise<Response> {
        try {
            const data = await request.json() as {
                name: string;
                values?: string[];
            };

            // Validate input
            if (!data || !data.name) {
                return errorResponse('Attribute name is required', 400);
            }

            // Check if attribute already exists
            const existingAttribute = await this.attributeRepository.findAttributeByName(data.name);
            if (existingAttribute) {
                return errorResponse('Attribute with this name already exists', 409);
            }

            // Create attribute
            const attributeId = await this.attributeRepository.createAttribute(data.name);

            // Create attribute values if provided
            if (data.values && Array.isArray(data.values) && data.values.length > 0) {
                await Promise.all(data.values.map(value =>
                    this.attributeRepository.createAttributeValue(attributeId, value)
                ));
            }

            // Get created attribute with values
            const attribute = await this.attributeRepository.findAttributeById(attributeId);
            const values = await this.attributeRepository.findAttributeValues(attributeId);

            return successResponse({
                message: 'Attribute created successfully',
                attribute,
                values
            }, 201);
        } catch (error) {
            console.error('Error creating product attribute:', error);
            return errorResponse('Failed to create product attribute', 500);
        }
    }

    /**
     * Update a product attribute
     * @param request Request object
     * @returns Response with updated attribute
     */
    async updateAttribute(request: AuthRequest): Promise<Response> {
        try {
            const attributeId = parseInt(request.params?.id || '');
            if (isNaN(attributeId)) {
                return errorResponse('Invalid attribute ID', 400);
            }

            const data = await request.json() as {
                name?: string;
                addValues?: string[];
                removeValues?: number[];
            };

            // Validate input
            if (!data || (!data.name && !data.addValues && !data.removeValues)) {
                return errorResponse('No update data provided', 400);
            }

            // Check if attribute exists
            const attribute = await this.attributeRepository.findAttributeById(attributeId);
            if (!attribute) {
                return errorResponse('Attribute not found', 404);
            }

            // Update attribute name if provided
            if (data.name) {
                // Check if name already exists for another attribute
                const existingAttribute = await this.attributeRepository.findAttributeByName(data.name);
                if (existingAttribute && existingAttribute.id !== attributeId) {
                    return errorResponse('Another attribute with this name already exists', 409);
                }

                await this.attributeRepository.updateAttribute(attributeId, data.name);
            }

            // Add new values if provided
            if (data.addValues && Array.isArray(data.addValues) && data.addValues.length > 0) {
                await Promise.all(data.addValues.map(value =>
                    this.attributeRepository.createAttributeValue(attributeId, value)
                ));
            }

            // Remove values if provided
            if (data.removeValues && Array.isArray(data.removeValues) && data.removeValues.length > 0) {
                await Promise.all(data.removeValues.map(valueId =>
                    this.attributeRepository.deleteAttributeValue(valueId)
                ));
            }

            // Get updated attribute with values
            const updatedAttribute = await this.attributeRepository.findAttributeById(attributeId);
            const values = await this.attributeRepository.findAttributeValues(attributeId);

            return successResponse({
                message: 'Attribute updated successfully',
                attribute: updatedAttribute,
                values
            });
        } catch (error) {
            console.error('Error updating product attribute:', error);
            return errorResponse('Failed to update product attribute', 500);
        }
    }

    /**
     * Delete a product attribute
     * @param request Request object
     * @returns Response with success message
     */
    async deleteAttribute(request: AuthRequest): Promise<Response> {
        try {
            const attributeId = parseInt(request.params?.id || '');
            if (isNaN(attributeId)) {
                return errorResponse('Invalid attribute ID', 400);
            }

            // Check if attribute exists
            const attribute = await this.attributeRepository.findAttributeById(attributeId);
            if (!attribute) {
                return errorResponse('Attribute not found', 404);
            }

            // Delete attribute (cascade should delete values)
            await this.attributeRepository.deleteAttribute(attributeId);

            return successResponse({
                message: 'Attribute deleted successfully'
            });
        } catch (error) {
            console.error('Error deleting product attribute:', error);
            return errorResponse('Failed to delete product attribute', 500);
        }
    }
}