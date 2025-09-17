import { IRequest } from 'itty-router';
import { Env } from '../models/common.model';
import { AuthRequest } from '../middleware/auth';
import { errorResponse, successResponse } from '../utils/response';
import { OrderRepository } from '../data/repositories/order.repository';
import { ShippingRepository } from '../data/repositories/shipping.repository';
import { DelhiveryService } from '../services/delhivery.service';
import { ShippingMethodCreateInput, ShippingMethodUpdateInput } from '../models/order.model';

/**
 * Controller for shipping-related operations
 */
export class ShippingController {
    private orderRepository: OrderRepository;
    private shippingRepository: ShippingRepository;
    private delhiveryService: DelhiveryService;

    constructor(private env: Env) {
        this.orderRepository = new OrderRepository(env);
        this.delhiveryService = new DelhiveryService(env);
        this.shippingRepository = new ShippingRepository(env);
    }

    /**
     * Get all shipping methods
     */
    async getShippingMethods(request: IRequest): Promise<Response> {
        try {
            // Query to get shipping methods
            const query = "SELECT * FROM shipping_methods WHERE is_active = 1";
            const { results: shippingMethods } = await this.env.DB.prepare(query).all();

            return successResponse(shippingMethods);
        } catch (error) {
            console.error('Error fetching shipping methods:', error);
            return errorResponse(error instanceof Error ? error.message : 'Failed to fetch shipping methods', 500);
        }
    }

    /**
     * Create a shipping method (admin only)
     */
    async createShippingMethod(request: AuthRequest): Promise<Response> {
        // Check if user is admin
        if (request.userRole !== 'admin') {
            return errorResponse('Unauthorized: Admin access required', 403);
        }

        try {
            const data = await request.json() as {
                name: string;
                description?: string;
                base_price: number;
                estimated_days?: number;
                is_active?: number;
            };

            // Validate the required fields
            if (!data.name || !data.base_price) {
                return errorResponse('Missing required fields: name, base_price', 400);
            }

            // Insert the shipping method
            const { success } = await this.env.DB.prepare(`
        INSERT INTO shipping_methods 
        (name, description, base_price, estimated_days, is_active) 
        VALUES (?, ?, ?, ?, ?)
      `).bind(
                data.name,
                data.description || '',
                data.base_price,
                data.estimated_days || null,
                data.is_active !== undefined ? data.is_active : 1
            ).run();

            if (!success) {
                return errorResponse('Failed to create shipping method', 500);
            }

            // Get the created shipping method
            const { results } = await this.env.DB.prepare(`
        SELECT * FROM shipping_methods 
        WHERE name = ? 
        ORDER BY id DESC 
        LIMIT 1
      `).bind(data.name).all();

            if (!results || results.length === 0) {
                return errorResponse('Failed to retrieve created shipping method', 500);
            }

            return successResponse({
                message: 'Shipping method created successfully',
                shippingMethod: results[0],
            });
        } catch (error) {
            console.error('Error creating shipping method:', error);
            return errorResponse(error instanceof Error ? error.message : 'Failed to create shipping method', 500);
        }
    }

    /**
     * Update a shipping method (admin only)
     */
    async updateShippingMethod(request: AuthRequest): Promise<Response> {
        // Check if user is admin
        if (request.userRole !== 'admin') {
            return errorResponse('Unauthorized: Admin access required', 403);
        }

        try {
            const shippingMethodId = request.params?.id;
            if (!shippingMethodId) {
                return errorResponse('Shipping method ID is required', 400);
            }

            // Check if shipping method exists
            const existingMethod = await this.env.DB.prepare(`
        SELECT * FROM shipping_methods WHERE id = ?
      `).bind(shippingMethodId).first();

            if (!existingMethod) {
                return errorResponse('Shipping method not found', 404);
            }

            const data = await request.json() as {
                name?: string;
                description?: string;
                base_price?: number;
                estimated_days?: number;
                is_active?: number;
            };

            // Build update query dynamically based on provided fields
            let query = 'UPDATE shipping_methods SET ';
            const updateFields = [];
            const values = [];

            if (data.name !== undefined) {
                updateFields.push('name = ?');
                values.push(data.name);
            }

            if (data.description !== undefined) {
                updateFields.push('description = ?');
                values.push(data.description);
            }

            if (data.base_price !== undefined) {
                updateFields.push('base_price = ?');
                values.push(data.base_price);
            }

            if (data.estimated_days !== undefined) {
                updateFields.push('estimated_days = ?');
                values.push(data.estimated_days);
            }

            if (data.is_active !== undefined) {
                updateFields.push('is_active = ?');
                values.push(data.is_active);
            }

            if (updateFields.length === 0) {
                return errorResponse('No fields provided for update', 400);
            }

            query += updateFields.join(', ') + ' WHERE id = ?';
            values.push(shippingMethodId);

            // Execute the update
            const { success } = await this.env.DB.prepare(query).bind(...values).run();

            if (!success) {
                return errorResponse('Failed to update shipping method', 500);
            }

            // Get the updated shipping method
            const updatedMethod = await this.env.DB.prepare(`
        SELECT * FROM shipping_methods WHERE id = ?
      `).bind(shippingMethodId).first();

            return successResponse({
                message: 'Shipping method updated successfully',
                shippingMethod: updatedMethod,
            });
        } catch (error) {
            console.error('Error updating shipping method:', error);
            return errorResponse(error instanceof Error ? error.message : 'Failed to update shipping method', 500);
        }
    }

    /**
     * Get shipping status for an order
     */
    async getOrderShippingStatus(request: AuthRequest): Promise<Response> {
        try {
            const orderId = request.params?.orderId;
            if (!orderId) {
                return errorResponse('Order ID is required', 400);
            }

            const orderIdNumber = parseInt(orderId);
            if (isNaN(orderIdNumber)) {
                return errorResponse('Invalid order ID', 400);
            }

            // Get the order
            const order = await this.orderRepository.getOrderById(orderIdNumber);

            // Check if the order belongs to the user (unless the user is an admin)
            if (order.user_id !== request.userId && request.userRole !== 'admin') {
                return errorResponse('Unauthorized', 403);
            }

            // Query shipping details from the shipping_tracking table
            const shipping = await this.env.DB.prepare(`
        SELECT tracking_number, estimated_delivery, status as shipping_status, carrier
        FROM shipping_tracking
        WHERE order_id = ?
      `).bind(orderIdNumber).first<{
                tracking_number?: string,
                estimated_delivery?: string,
                shipping_status?: string,
                carrier?: string
            }>();

            // If we have a tracking number, use Delhivery to get real-time tracking updates
            let trackingInfo = null;
            if (shipping?.tracking_number && shipping.carrier === 'Delhivery') {
                try {
                    trackingInfo = await this.shippingRepository.trackShipment(shipping.tracking_number);
                } catch (trackingError) {
                    console.error('Error tracking shipment, using database info instead:', trackingError);
                    // We'll continue with the database information
                }
            }

            // Get shipping details from order
            return successResponse({
                orderId: order.id,
                shippingMethod: order.shipping_method,
                shippingAddress: order.shipping_address,
                trackingNumber: shipping?.tracking_number || null,
                carrier: shipping?.carrier || null,
                estimatedDelivery: trackingInfo?.estimatedDelivery || shipping?.estimated_delivery || null,
                shippingStatus: trackingInfo?.status || shipping?.shipping_status || 'pending',
                trackingEvents: trackingInfo?.events || [],
                trackingUrl: shipping?.carrier === 'Delhivery' && shipping?.tracking_number ?
                    `https://www.delhivery.com/track/package/${shipping.tracking_number}` : null
            });
        } catch (error) {
            console.error('Error fetching shipping status:', error);
            return errorResponse(error instanceof Error ? error.message : 'Failed to fetch shipping status', 500);
        }
    }

    /**
     * Track a shipment using its tracking number
     */
    async trackShipment(request: IRequest): Promise<Response> {
        try {
            const { trackingNumber } = request.params || {};
            if (!trackingNumber) {
                return errorResponse('Tracking number is required', 400);
            }

            // Get tracking information using the shipping repository
            const trackingInfo = await this.shippingRepository.trackShipment(trackingNumber);

            return successResponse({
                carrier: trackingInfo.carrier,
                trackingNumber: trackingInfo.trackingNumber,
                status: trackingInfo.status,
                estimatedDelivery: trackingInfo.estimatedDelivery,
                events: trackingInfo.events,
                trackingUrl: `https://www.delhivery.com/track/package/${trackingNumber}`
            });
        } catch (error) {
            console.error('Error tracking shipment:', error);
            return errorResponse(error instanceof Error ? error.message : 'Failed to track shipment', 500);
        }
    }

    /**
     * Update order shipping status (admin only)
     */
    async updateOrderShippingStatus(request: AuthRequest): Promise<Response> {
        // Check if user is admin
        if (request.userRole !== 'admin') {
            return errorResponse('Unauthorized: Admin access required', 403);
        }

        try {
            const orderId = request.params?.orderId;
            if (!orderId) {
                return errorResponse('Order ID is required', 400);
            }

            const orderIdNumber = parseInt(orderId);
            if (isNaN(orderIdNumber)) {
                return errorResponse('Invalid order ID', 400);
            }

            const data = await request.json() as {
                shippingStatus: string;
                trackingNumber?: string;
            };
            const { shippingStatus, trackingNumber } = data;

            if (!shippingStatus) {
                return errorResponse('Shipping status is required', 400);
            }

            // Update order shipping status
            const { success } = await this.env.DB.prepare(`
        UPDATE orders 
        SET shipping_status = ?, 
            tracking_number = COALESCE(?, tracking_number),
            updated_at = datetime('now')
        WHERE id = ?
      `).bind(
                shippingStatus,
                trackingNumber || null,
                orderIdNumber
            ).run();

            if (!success) {
                return errorResponse('Failed to update shipping status', 500);
            }

            // Get the updated order
            const updatedOrder = await this.orderRepository.getOrderById(orderIdNumber);

            return successResponse({
                message: 'Shipping status updated successfully',
                order: updatedOrder,
            });
        } catch (error) {
            console.error('Error updating shipping status:', error);
            return errorResponse(error instanceof Error ? error.message : 'Failed to update shipping status', 500);
        }
    }

    /**
     * Generate shipping label for an order using Delhivery (admin only)
     */
    async generateShippingLabel(request: AuthRequest): Promise<Response> {
        // Check if user is admin
        if (request.userRole !== 'admin') {
            return errorResponse('Unauthorized: Admin access required', 403);
        }

        try {
            const orderId = request.params?.orderId;
            if (!orderId) {
                return errorResponse('Order ID is required', 400);
            }

            const orderIdNumber = parseInt(orderId);
            if (isNaN(orderIdNumber)) {
                return errorResponse('Invalid order ID', 400);
            }

            // Check if order exists and is in a valid status
            const order = await this.orderRepository.getOrderById(orderIdNumber);
            if (!order) {
                return errorResponse(`Order with ID ${orderId} not found`, 404);
            }

            // Only generate label for orders in certain statuses
            const validStatuses = ['processing', 'ready_to_ship', 'confirmed'];
            if (!validStatuses.includes(order.status)) {
                return errorResponse(`Cannot generate shipping label for order in '${order.status}' status. Order must be in one of these statuses: ${validStatuses.join(', ')}`, 400);
            }

            // Generate shipping label with Delhivery
            const labelResult = await this.shippingRepository.generateShippingLabel(orderIdNumber);

            return successResponse({
                message: 'Shipping label generated successfully',
                trackingNumber: labelResult.trackingNumber,
                labelUrl: labelResult.labelUrl,
                carrier: labelResult.carrier,
                orderStatus: 'shipped' // The repository updates the order status to shipped
            });
        } catch (error) {
            console.error('Error generating shipping label:', error);
            return errorResponse(error instanceof Error ? error.message : 'Failed to generate shipping label', 500);
        }
    }

    /**
     * Calculate shipping cost based on shipping method and address
     */
    async calculateShippingCost(request: IRequest): Promise<Response> {
        try {
            const data = await request.json() as {
                shippingMethodId: number;
                addressId: number;
                items?: Array<{
                    productVariantId: number;
                    quantity: number;
                }>;
            };
            const { shippingMethodId, addressId, items } = data;

            if (!shippingMethodId || !addressId) {
                return errorResponse('Shipping method ID and address ID are required', 400);
            }

            // Get the shipping method to include its name in the response
            const shippingMethod = await this.env.DB.prepare(`
        SELECT id, name FROM shipping_methods WHERE id = ?
      `).bind(shippingMethodId).first<{ id: number, name: string }>();

            if (!shippingMethod) {
                return errorResponse('Shipping method not found', 404);
            }

            // Use the repository to calculate shipping costs with Delhivery integration
            const calculationResult = await this.shippingRepository.calculateShippingCost({
                shippingMethodId,
                addressId,
                items: items || [] // If no items provided, use empty array
            });

            // Get address country for currency determination
            const address = await this.env.DB.prepare(`
        SELECT country FROM addresses WHERE id = ?
      `).bind(addressId).first<{ country: string }>();

            // Determine currency based on shipping address country
            let currency = 'USD';
            if (address?.country === 'IN') {
                currency = 'INR';
            }

            // Calculate estimated delivery date
            const estimatedDays = calculationResult.estimatedDays || 7; // Default to 7 days if not specified
            const today = new Date();
            const estimatedDelivery = new Date();
            estimatedDelivery.setDate(today.getDate() + estimatedDays);

            return successResponse({
                shippingMethodId,
                shippingMethodName: shippingMethod.name,
                cost: calculationResult.cost,
                currency,
                estimatedDeliveryDays: estimatedDays,
                estimatedDeliveryDate: estimatedDelivery.toISOString().split('T')[0],
                carrier: 'Delhivery' // When using Delhivery integration
            });
        } catch (error) {
            console.error('Error calculating shipping cost:', error);
            return errorResponse(error instanceof Error ? error.message : 'Failed to calculate shipping cost', 500);
        }
    }
}