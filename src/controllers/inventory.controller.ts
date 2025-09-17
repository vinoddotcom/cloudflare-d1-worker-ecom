import { IRequest } from 'itty-router';
import { Env } from '../models/common.model';
import { AuthRequest } from '../middleware/auth';
import { InventoryRepository } from '../data/repositories/inventory.repository';
import { successResponse, errorResponse } from '../utils/response';
import { validateInput } from '../utils/input-validation';

/**
 * Controller for inventory management operations
 */
export class InventoryController {
    private inventoryRepository: InventoryRepository;

    constructor(env: Env) {
        this.inventoryRepository = new InventoryRepository(env);
    }

    /**
     * Get all inventory items with optional filtering
     * @param request The request object
     * @returns Response with inventory items
     */
    async getAllInventory(request: AuthRequest): Promise<Response> {
        try {
            const { url } = request;
            const params = new URL(url).searchParams;

            // Parse query parameters
            const lowStock = params.get('lowStock') === 'true';
            const productId = params.get('productId') ? parseInt(params.get('productId') as string) : undefined;
            const limit = params.get('limit') ? parseInt(params.get('limit') as string) : 100;
            const page = params.get('page') ? parseInt(params.get('page') as string) : 1;

            const inventoryItems = await this.inventoryRepository.getAllInventory({
                lowStock,
                productId,
                limit,
                page
            });

            const total = await this.inventoryRepository.getInventoryCount({
                lowStock,
                productId
            });

            return successResponse({
                items: inventoryItems,
                pagination: {
                    total,
                    page,
                    limit,
                    totalPages: Math.ceil(total / limit)
                }
            });
        } catch (error) {
            console.error('Error getting inventory:', error);
            return errorResponse('Failed to get inventory', 500);
        }
    }

    /**
     * Update inventory for a specific product variant
     * @param request The request object
     * @returns Response with updated inventory
     */
    async updateInventory(request: AuthRequest): Promise<Response> {
        try {
            const variantId = parseInt(request.params?.variantId || '');
            if (isNaN(variantId)) {
                return errorResponse('Invalid variant ID', 400);
            }

            const data = await request.json() as {
                quantity?: number;
                reserved_quantity?: number;
                reorder_level?: number;
                reorder_quantity?: number;
            };

            // Validate input
            if (!data || Object.keys(data).length === 0) {
                return errorResponse('No inventory data provided', 400);
            }

            // Check if the inventory exists
            const existingInventory = await this.inventoryRepository.getInventoryByVariantId(variantId);
            if (!existingInventory) {
                // Create new inventory record if it doesn't exist
                await this.inventoryRepository.createInventory({
                    product_variant_id: variantId,
                    quantity: data.quantity || 0,
                    reserved_quantity: data.reserved_quantity || 0,
                    reorder_level: data.reorder_level || 5,
                    reorder_quantity: data.reorder_quantity || 10,
                });
            } else {
                // Update existing inventory
                await this.inventoryRepository.updateInventory(variantId, {
                    quantity: data.quantity !== undefined ? data.quantity : existingInventory.quantity,
                    reserved_quantity: data.reserved_quantity !== undefined ? data.reserved_quantity : existingInventory.reserved_quantity,
                    reorder_level: data.reorder_level !== undefined ? data.reorder_level : existingInventory.reorder_level,
                    reorder_quantity: data.reorder_quantity !== undefined ? data.reorder_quantity : existingInventory.reorder_quantity,
                });
            }

            // Get the updated inventory
            const updatedInventory = await this.inventoryRepository.getInventoryByVariantId(variantId);

            return successResponse({
                message: 'Inventory updated successfully',
                inventory: updatedInventory
            });
        } catch (error) {
            console.error('Error updating inventory:', error);
            return errorResponse('Failed to update inventory', 500);
        }
    }

    /**
     * Bulk update inventory for multiple product variants
     * @param request The request object
     * @returns Response with update results
     */
    async bulkUpdateInventory(request: AuthRequest): Promise<Response> {
        try {
            const data = await request.json() as {
                items: Array<{
                    product_variant_id: number;
                    quantity?: number;
                    reserved_quantity?: number;
                    reorder_level?: number;
                    reorder_quantity?: number;
                }>
            };

            if (!data.items || !Array.isArray(data.items) || data.items.length === 0) {
                return errorResponse('Invalid inventory data. Expected an array of items.', 400);
            }

            const results = {
                success: 0,
                failed: 0,
                errors: [] as Array<{ variantId: number; error: string }>
            };

            // Process each inventory item
            for (const item of data.items) {
                try {
                    if (!item.product_variant_id) {
                        results.failed++;
                        results.errors.push({
                            variantId: item.product_variant_id || 0,
                            error: 'Missing product_variant_id'
                        });
                        continue;
                    }

                    // Check if the inventory exists
                    const existingInventory = await this.inventoryRepository.getInventoryByVariantId(item.product_variant_id);

                    if (!existingInventory) {
                        // Create new inventory record
                        await this.inventoryRepository.createInventory({
                            product_variant_id: item.product_variant_id,
                            quantity: item.quantity || 0,
                            reserved_quantity: item.reserved_quantity || 0,
                            reorder_level: item.reorder_level || 5,
                            reorder_quantity: item.reorder_quantity || 10,
                        });
                    } else {
                        // Update existing inventory
                        await this.inventoryRepository.updateInventory(item.product_variant_id, {
                            quantity: item.quantity !== undefined ? item.quantity : existingInventory.quantity,
                            reserved_quantity: item.reserved_quantity !== undefined ? item.reserved_quantity : existingInventory.reserved_quantity,
                            reorder_level: item.reorder_level !== undefined ? item.reorder_level : existingInventory.reorder_level,
                            reorder_quantity: item.reorder_quantity !== undefined ? item.reorder_quantity : existingInventory.reorder_quantity,
                        });
                    }
                    results.success++;
                } catch (error) {
                    results.failed++;
                    results.errors.push({
                        variantId: item.product_variant_id,
                        error: error instanceof Error ? error.message : 'Unknown error'
                    });
                }
            }

            return successResponse({
                message: `Processed ${data.items.length} inventory items. ${results.success} succeeded, ${results.failed} failed.`,
                results
            });
        } catch (error) {
            console.error('Error bulk updating inventory:', error);
            return errorResponse('Failed to update inventory in bulk', 500);
        }
    }
}