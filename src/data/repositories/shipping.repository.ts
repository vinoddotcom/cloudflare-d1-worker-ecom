import { Env } from '../../models/common.model';
import { BaseRepository } from './base.repository';
import { ShippingMethod } from '../../models/order.model';
import { DelhiveryService } from '../../services/delhivery.service';

/**
 * Repository for shipping-related database operations
 */
export class ShippingRepository extends BaseRepository<ShippingMethod> {
    private delhiveryService: DelhiveryService;

    constructor(private env: Env) {
        super(env.DB, 'shipping_methods');
        this.delhiveryService = new DelhiveryService(env);
    }

    /**
     * Get all active shipping methods
     * @returns List of available shipping methods
     */
    async getActiveShippingMethods(): Promise<ShippingMethod[]> {
        try {
            const query = `
        SELECT *
        FROM shipping_methods
        WHERE is_active = 1
        ORDER BY base_price ASC
      `;

            const result = await this.db.prepare(query).all<ShippingMethod>();
            return result.results || [];
        } catch (error) {
            console.error('Error fetching shipping methods:', error);
            throw error;
        }
    }

    /**
     * Calculate shipping cost for an order using Delhivery
     * @param data Shipping calculation inputs
     * @returns Calculated shipping cost from Delhivery or fallback to our calculation
     */
    async calculateShippingCost(data: {
        shippingMethodId: number;
        addressId: number;
        items: Array<{
            productVariantId: number;
            quantity: number;
        }>;
    }): Promise<{ cost: number; estimatedDays?: number }> {
        try {
            const { shippingMethodId, addressId, items } = data;

            // Get shipping method details
            const shippingMethod = await this.findById(shippingMethodId.toString());
            if (!shippingMethod) {
                throw new Error(`Shipping method with ID ${shippingMethodId} not found`);
            }

            // Get address for zone calculation
            const address = await this.db.prepare(`
        SELECT postal_code, city, state, country FROM addresses WHERE id = ?
      `).bind(addressId).first<{ postal_code: string, city: string, state: string, country: string }>();

            if (!address) {
                throw new Error(`Address with ID ${addressId} not found`);
            }

            // Calculate total weight
            let totalWeight = 0;

            // Fetch all product variant IDs in one query for efficiency
            const variantIds = items.map(item => item.productVariantId);
            const placeholders = variantIds.map(() => '?').join(',');

            const productsResult = await this.db.prepare(`
        SELECT 
          pv.id as variant_id, 
          p.weight, 
          p.weight_unit
        FROM product_variants pv
        JOIN products p ON pv.product_id = p.id
        WHERE pv.id IN (${placeholders})
      `).bind(...variantIds).all();

            interface ProductWithWeight {
                variant_id: number;
                weight?: number;
                weight_unit?: string;
            }

            const products = (productsResult.results || []) as ProductWithWeight[];

            // Calculate total weight
            for (const item of items) {
                const product = products.find(p => p.variant_id === item.productVariantId);
                if (product && product.weight) {
                    // Convert all weights to kg for consistency
                    let weight = product.weight;
                    if (product.weight_unit === 'g') {
                        weight /= 1000;
                    } else if (product.weight_unit === 'lb') {
                        weight *= 0.453592; // Convert lb to kg
                    } else if (product.weight_unit === 'oz') {
                        weight *= 0.0283495; // Convert oz to kg
                    }

                    totalWeight += weight * item.quantity;
                }
            }

            // If no weight found, use a default
            if (totalWeight <= 0) {
                totalWeight = 0.5; // Default to 0.5kg
            }

            // Get warehouse address for origin pincode
            const warehouseAddress = await this.db.prepare(`
        SELECT postal_code FROM addresses
        WHERE address_type = 'shipping' AND is_default = 1
        LIMIT 1
      `).first<{ postal_code: string }>();

            const originPincode = warehouseAddress?.postal_code || '110001'; // Default to Delhi

            // For Indian addresses, use Delhivery rate calculation
            if (address.country === 'IN') {
                try {
                    const rateResult = await this.delhiveryService.calculateRate(
                        originPincode,
                        address.postal_code,
                        totalWeight
                    );

                    if (rateResult.success) {
                        return {
                            cost: rateResult.rate,
                            estimatedDays: rateResult.expected_delivery_days
                        };
                    }
                } catch (error) {
                    console.warn('Error calculating Delhivery rate, falling back to local calculation:', error);
                    // Continue with fallback calculation
                }
            }

            // Fallback to our calculation method if Delhivery is unavailable or for non-Indian addresses

            // Base cost from the shipping method
            let shippingCost = shippingMethod.base_price;

            // Add weight-based charges
            // $2 per kg after the first kg
            if (totalWeight > 1) {
                shippingCost += (totalWeight - 1) * 2;
            }

            // Add zone-based surcharges
            // This could be more sophisticated with a zones table
            // Simulating zone calculation based on country
            const internationalCountries = ['CA', 'GB', 'AU', 'DE', 'FR', 'JP', 'CN'];

            if (address.country !== 'US') {
                // International shipping surcharge
                if (internationalCountries.includes(address.country)) {
                    shippingCost *= 2; // Double for international
                } else {
                    shippingCost *= 3; // Triple for other countries
                }
            } else {
                // Domestic shipping - apply state-based adjustments
                // Example: Higher costs for Alaska and Hawaii
                if (address.state === 'AK' || address.state === 'HI') {
                    shippingCost *= 1.5;
                }
            }

            // Round to two decimal places
            shippingCost = Math.round(shippingCost * 100) / 100;

            return {
                cost: shippingCost,
                estimatedDays: shippingMethod.estimated_days
            };
        } catch (error) {
            console.error('Error calculating shipping cost:', error);
            throw error;
        }
    }

    /**
     * Create a new shipping method
     * @param data Shipping method data
     * @returns The created shipping method
     */
    async createShippingMethod(data: {
        name: string;
        description?: string;
        basePrice: number;
        isActive?: boolean;
        estimatedDays?: number;
    }): Promise<ShippingMethod> {
        try {
            const now = Math.floor(Date.now() / 1000);

            const {
                name,
                description,
                basePrice,
                isActive = true,
                estimatedDays
            } = data;

            // Check if method with this name already exists
            const existingMethod = await this.db.prepare(`
        SELECT id FROM shipping_methods WHERE name = ?
      `).bind(name).first();

            if (existingMethod) {
                throw new Error(`Shipping method with name "${name}" already exists`);
            }

            // Create shipping method
            const query = `
        INSERT INTO shipping_methods (
          name,
          description,
          base_price,
          is_active,
          estimated_days,
          created_at,
          updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `;

            const result = await this.db.prepare(query).bind(
                name,
                description || null,
                basePrice,
                isActive ? 1 : 0,
                estimatedDays || null,
                now,
                now
            ).run();

            if (!result.success) {
                throw new Error('Failed to create shipping method');
            }

            // Return the created shipping method using the RETURNING clause
            const { results } = await this.db.prepare(`
        SELECT * FROM shipping_methods 
        ORDER BY id DESC 
        LIMIT 1
      `).all<ShippingMethod>();

            if (!results || results.length === 0) {
                throw new Error('Failed to fetch created shipping method');
            }

            return results[0];
        } catch (error) {
            console.error('Error creating shipping method:', error);
            throw error;
        }
    }

    /**
     * Update a shipping method
     * @param id Shipping method ID
     * @param data Updated shipping method data
     * @returns The updated shipping method
     */
    async updateShippingMethod(
        id: number,
        data: {
            name?: string;
            description?: string;
            basePrice?: number;
            isActive?: boolean;
            estimatedDays?: number;
        }
    ): Promise<ShippingMethod> {
        try {
            const now = Math.floor(Date.now() / 1000);

            // Check if shipping method exists
            const existingMethod = await this.findById(id.toString());

            if (!existingMethod) {
                throw new Error(`Shipping method with ID ${id} not found`);
            }

            // Prepare update fields
            const updateFields = [];
            const params = [];

            if (data.name !== undefined) {
                // Check for name uniqueness if name is being changed
                if (data.name !== existingMethod.name) {
                    const nameCheck = await this.db.prepare(`
            SELECT id FROM shipping_methods WHERE name = ? AND id != ?
          `).bind(data.name, id).first();

                    if (nameCheck) {
                        throw new Error(`Shipping method with name "${data.name}" already exists`);
                    }
                }

                updateFields.push('name = ?');
                params.push(data.name);
            }

            if (data.description !== undefined) {
                updateFields.push('description = ?');
                params.push(data.description || null);
            }

            if (data.basePrice !== undefined) {
                updateFields.push('base_price = ?');
                params.push(data.basePrice);
            }

            if (data.isActive !== undefined) {
                updateFields.push('is_active = ?');
                params.push(data.isActive ? 1 : 0);
            }

            if (data.estimatedDays !== undefined) {
                updateFields.push('estimated_days = ?');
                params.push(data.estimatedDays || null);
            }

            // Add updated_at
            updateFields.push('updated_at = ?');
            params.push(now);

            // Add ID to params
            params.push(id);

            // Update shipping method if there are fields to update
            if (updateFields.length > 0) {
                const query = `
          UPDATE shipping_methods
          SET ${updateFields.join(', ')}
          WHERE id = ?
        `;

                await this.db.prepare(query).bind(...params).run();
            }

            // Return updated shipping method
            return this.findById(id.toString()) as Promise<ShippingMethod>;
        } catch (error) {
            console.error('Error updating shipping method:', error);
            throw error;
        }
    }

    /**
     * Generate shipping label using Delhivery
     * @param orderId Order ID
     * @returns Tracking number and shipping details
     */
    async generateShippingLabel(orderId: number): Promise<{
        trackingNumber: string;
        labelUrl: string;
        carrier: string;
    }> {
        try {
            // Get order details with shipping and warehouse addresses
            const order = await this.db.prepare(`
        SELECT 
          o.*,
          sa.id as ship_address_id,
          sa.address_line1 as ship_address_line1,
          sa.address_line2 as ship_address_line2,
          sa.city as ship_city,
          sa.state as ship_state,
          sa.postal_code as ship_postal_code,
          sa.country as ship_country,
          sa.name as ship_name,
          sa.phone as ship_phone,
          sa.landmark as ship_landmark,
          wa.address_line1 as warehouse_address_line1,
          wa.address_line2 as warehouse_address_line2,
          wa.city as warehouse_city,
          wa.state as warehouse_state,
          wa.postal_code as warehouse_postal_code,
          wa.country as warehouse_country,
          wa.name as warehouse_name,
          wa.phone as warehouse_phone,
          wa.landmark as warehouse_landmark,
          u.first_name,
          u.last_name,
          u.email,
          u.phone
        FROM orders o
        JOIN addresses sa ON o.shipping_address_id = sa.id
        JOIN addresses wa ON wa.address_type = 'warehouse' AND wa.is_default = 1
        JOIN users u ON o.user_id = u.id
        WHERE o.id = ?
      `).bind(orderId).first<any>();

            if (!order) {
                throw new Error(`Order with ID ${orderId} not found`);
            }

            // Get order items for package details
            const orderItems = await this.db.prepare(`
        SELECT 
          oi.*,
          p.weight,
          p.weight_unit,
          p.length,
          p.width,
          p.height,
          p.dimension_unit,
          p.name as product_name
        FROM order_items oi
        JOIN product_variants pv ON oi.product_variant_id = pv.id
        JOIN products p ON pv.product_id = p.id
        WHERE oi.order_id = ?
      `).bind(orderId).all<any>();

            if (!orderItems.results || orderItems.results.length === 0) {
                throw new Error(`No items found for order ID ${orderId}`);
            }

            // Calculate total weight and get descriptions
            let totalWeight = 0;
            const productDescriptions: string[] = [];

            for (const item of orderItems.results) {
                // Convert weights to kg
                let weight = item.weight || 0.5; // Default to 0.5kg if not specified
                if (item.weight_unit === 'g') {
                    weight /= 1000;
                } else if (item.weight_unit === 'lb') {
                    weight *= 0.453592; // Convert lb to kg
                }

                totalWeight += weight * item.quantity;
                productDescriptions.push(`${item.quantity}x ${item.product_name}`);
            }

            // Get the first item's dimensions for the package (simplified approach)
            const firstItem = orderItems.results[0];
            const dimensions = {
                length: firstItem.length || 10, // Default to 10cm if not specified
                breadth: firstItem.width || 10,
                height: firstItem.height || 5
            };

            // Convert dimensions to cm if needed
            if (firstItem.dimension_unit === 'in') {
                dimensions.length *= 2.54;
                dimensions.breadth *= 2.54;
                dimensions.height *= 2.54;
            }

            // Prepare shipment addresses
            const shipToAddress = {
                id: order.ship_address_id,
                user_id: order.user_id,
                name: order.ship_name || `${order.first_name} ${order.last_name}`,
                address_line1: order.ship_address_line1,
                address_line2: order.ship_address_line2,
                city: order.ship_city,
                state: order.ship_state,
                postal_code: order.ship_postal_code,
                country: order.ship_country,
                phone: order.ship_phone || order.phone,
                landmark: order.ship_landmark,
                created_at: 0,
                address_type: 'shipping' as const,
                is_default: true
            };

            const shipFromAddress = {
                id: 0,
                user_id: 'system',
                name: order.warehouse_name || 'Warehouse',
                address_line1: order.warehouse_address_line1 || '123 Warehouse St',
                address_line2: order.warehouse_address_line2,
                city: order.warehouse_city || 'Warehouse City',
                state: order.warehouse_state || 'WA',
                postal_code: order.warehouse_postal_code || '12345',
                country: order.warehouse_country || 'US',
                phone: order.warehouse_phone || '1234567890',
                landmark: order.warehouse_landmark,
                created_at: 0,
                address_type: 'shipping' as const, // Use shipping as the type since warehouse isn't a valid type
                is_default: true
            };

            // Check if payment is prepaid or COD
            const isPrepaid = order.payment_method !== 'cod';

            // Create shipment with Delhivery
            const shipmentResult = await this.delhiveryService.createShipment(
                order.id.toString(),
                shipFromAddress,
                shipToAddress,
                {
                    weight: totalWeight,
                    length: dimensions.length,
                    breadth: dimensions.breadth,
                    height: dimensions.height,
                    productValue: order.total_amount,
                    description: productDescriptions.join(', ')
                },
                isPrepaid
            );

            if (!shipmentResult.success) {
                throw new Error(`Failed to create shipment: ${shipmentResult.errors?.join(', ')}`);
            }

            const trackingNumber = shipmentResult.waybill;
            const labelUrl = `https://track.delhivery.com/api/p/packing-slip/${trackingNumber}`;

            // Update order status to shipped if it was in processing
            if (order.status === 'processing') {
                const now = Math.floor(Date.now() / 1000);

                await this.db.prepare(`
          UPDATE orders
          SET status = 'shipped', updated_at = ?
          WHERE id = ?
        `).bind(now, orderId).run();

                // Add status history entry
                await this.db.prepare(`
          INSERT INTO order_status_history (
            order_id,
            status,
            notes,
            created_by,
            created_at
          ) VALUES (?, ?, ?, ?, ?)
        `).bind(
                    orderId,
                    'shipped',
                    `Shipped via Delhivery. Tracking number: ${trackingNumber}`,
                    'system',
                    now
                ).run();
            }

            // Create an entry in the shipping_tracking table
            await this.db.prepare(`
        INSERT INTO shipping_tracking (
          order_id,
          tracking_number,
          carrier,
          status,
          estimated_delivery,
          created_at,
          updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `).bind(
                orderId,
                trackingNumber,
                'Delhivery',
                'shipped',
                new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // Default to 7 days
                Math.floor(Date.now() / 1000),
                Math.floor(Date.now() / 1000)
            ).run();

            return {
                trackingNumber,
                labelUrl,
                carrier: 'Delhivery'
            };
        } catch (error) {
            console.error('Error generating shipping label with Delhivery:', error);
            throw error;
        }
    }

    /**
     * Track a shipment using Delhivery
     * @param trackingNumber Tracking number
     * @returns Tracking information from Delhivery
     */
    async trackShipment(trackingNumber: string): Promise<{
        carrier: string;
        trackingNumber: string;
        status: string;
        estimatedDelivery?: string;
        events: Array<{
            date: string;
            location: string;
            activity: string;
        }>;
    }> {
        try {
            // Check if shipment exists in our database
            const shipment = await this.db.prepare(`
        SELECT * FROM shipping_tracking WHERE tracking_number = ?
      `).bind(trackingNumber).first();

            if (!shipment) {
                throw new Error(`No shipment found with tracking number ${trackingNumber}`);
            }

            // Get tracking information from Delhivery
            const trackingResult = await this.delhiveryService.trackShipment(trackingNumber);

            if (!trackingResult.success) {
                throw new Error(`Failed to track shipment: ${trackingResult.errors?.join(', ')}`);
            }

            // Map Delhivery tracking data to our format
            const trackingData = trackingResult.tracking_data;

            // Convert Delhivery status to our status format
            let status = 'in_transit';
            if (trackingData.status_code === 'Delivered') {
                status = 'delivered';
            } else if (trackingData.status_code === 'Out for Delivery') {
                status = 'out_for_delivery';
            } else if (trackingData.status_code === 'Pending Pickup') {
                status = 'pending';
            }

            // Format events
            const events = trackingData.scans.map(scan => ({
                date: scan.scan_date,
                location: scan.scan_location,
                activity: scan.status_description
            }));

            // Update shipping status in our database
            const now = Math.floor(Date.now() / 1000);
            await this.db.prepare(`
        UPDATE shipping_tracking
        SET 
          status = ?,
          estimated_delivery = ?,
          updated_at = ?
        WHERE tracking_number = ?
      `).bind(
                status,
                trackingData.expected_delivery_date,
                now,
                trackingNumber
            ).run();

            // Get the order ID for this shipment
            const shipmentRecord = await this.db.prepare(`
          SELECT order_id FROM shipping_tracking WHERE tracking_number = ?
        `).bind(trackingNumber).first<{ order_id?: number }>();

            // If delivered, update the order status
            if (status === 'delivered' && shipmentRecord && shipmentRecord.order_id) {
                await this.db.prepare(`
          UPDATE orders
          SET status = 'delivered', updated_at = ?
          WHERE id = ?
        `).bind(now, shipmentRecord.order_id).run();

                // Add status history entry
                await this.db.prepare(`
          INSERT INTO order_status_history (
            order_id,
            status,
            notes,
            created_by,
            created_at
          ) VALUES (?, ?, ?, ?, ?)
        `).bind(
                    shipmentRecord.order_id,
                    'delivered',
                    `Delivered by Delhivery on ${new Date(trackingData.delivery_date || Date.now()).toISOString().split('T')[0]}`,
                    'system',
                    now
                ).run();
            }

            return {
                carrier: 'Delhivery',
                trackingNumber,
                status,
                estimatedDelivery: trackingData.expected_delivery_date,
                events
            };
        } catch (error) {
            console.error('Error tracking shipment with Delhivery:', error);

            // If there's an error with Delhivery, fall back to our database record
            try {
                interface ShipmentRecord {
                    tracking_number: string;
                    order_id?: number;
                    status?: string;
                    estimated_delivery?: string;
                    created_at: number;
                }

                const shipment = await this.db.prepare(`
          SELECT * FROM shipping_tracking WHERE tracking_number = ?
        `).bind(trackingNumber).first<ShipmentRecord>();

                if (shipment) {
                    return {
                        carrier: 'Delhivery',
                        trackingNumber,
                        status: shipment.status || 'unknown',
                        estimatedDelivery: shipment.estimated_delivery,
                        events: [{
                            date: new Date(shipment.created_at * 1000).toISOString(),
                            location: 'System',
                            activity: 'Shipment created'
                        }]
                    };
                }
            } catch (dbError) {
                console.error('Error getting fallback tracking data:', dbError);
            }

            throw error;
        }
    }

    /**
     * Generate random string of specified length from character set
     */
    private generateRandomString(length: number, chars: string): string {
        let result = '';
        for (let i = 0; i < length; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return result;
    }
}