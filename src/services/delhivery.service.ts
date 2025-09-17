import { Env } from '../models/common.model';
import { Address } from '../models/user.model';

// Define Delhivery API endpoints
const DELHIVERY_API_BASE = 'https://track.delhivery.com/api';
const ENDPOINTS = {
    CREATE_SHIPMENT: '/v1/packages/json/',
    TRACK_SHIPMENT: '/v1/packages/json/track/',
    CANCEL_SHIPMENT: '/v1/packages/json/cancel/',
    CALCULATE_RATE: '/v1/packages/json/estimate/',
    PINCODES: '/v1/pincodes/',
};

// Delhivery response types
export interface DelhiveryShipmentResponse {
    success: boolean;
    waybill: string; // Tracking number
    reference: string; // Our order ID
    status: string;
    errors?: string[];
    message?: string;
}

export interface DelhiveryTrackingResponse {
    success: boolean;
    tracking_data: {
        track_id: string;
        shipment_id: string;
        status: string;
        status_code: string;
        status_description: string;
        last_update_date: string;
        expected_delivery_date?: string;
        delivery_date?: string;
        scans: {
            scan_type: string;
            scan_date: string;
            scan_location: string;
            status_code: string;
            status_description: string;
        }[];
    };
    errors?: string[];
}

export interface DelhiveryRateCalculationResponse {
    success: boolean;
    rate: number;
    expected_delivery_days: number;
    currency: string;
    errors?: string[];
}

export interface DelhiveryPincodeResponse {
    success: boolean;
    delivery_codes: {
        postal_code: string;
        country: string;
        city: string;
        state: string;
        district: string;
        pre_paid: boolean;
        cash: boolean;
        pickup: boolean;
        serviceable: boolean;
    }[];
    errors?: string[];
}

/**
 * Service class for integrating with Delhivery shipping API
 */
export class DelhiveryService {
    private apiKey: string;

    constructor(private env: Env) {
        // Get API key from environment variables
        this.apiKey = env.DELHIVERY_API_KEY || '';

        if (!this.apiKey) {
            console.warn('Delhivery API key not configured. Shipping operations will fail.');
        }
    }

    /**
     * Create a new shipment in Delhivery
     * @param orderId Order ID
     * @param shipFromAddress Warehouse/Pickup address
     * @param shipToAddress Delivery address
     * @param packageDetails Package details (weight, dimensions, etc.)
     * @param isPrepaid Whether the shipping is prepaid or COD
     */
    async createShipment(
        orderId: string,
        shipFromAddress: Address,
        shipToAddress: Address,
        packageDetails: {
            weight: number; // in kg
            length?: number; // in cm
            breadth?: number; // in cm
            height?: number; // in cm
            productValue: number; // in INR
            description: string;
        },
        isPrepaid: boolean = true
    ): Promise<DelhiveryShipmentResponse> {
        try {
            // Format the request payload according to Delhivery API requirements
            const payload = {
                format: 'json',
                data: {
                    shipments: [
                        {
                            name: shipToAddress.name,
                            add: this.formatAddress(shipToAddress),
                            pin: shipToAddress.postal_code,
                            city: shipToAddress.city,
                            state: shipToAddress.state,
                            country: shipToAddress.country,
                            phone: shipToAddress.phone,
                            order: orderId,
                            payment_mode: isPrepaid ? 'Prepaid' : 'COD',
                            cod_amount: isPrepaid ? '0' : packageDetails.productValue.toString(),
                            return_pin: shipFromAddress.postal_code,
                            return_city: shipFromAddress.city,
                            return_phone: shipFromAddress.phone,
                            return_add: this.formatAddress(shipFromAddress),
                            return_state: shipFromAddress.state,
                            return_country: shipFromAddress.country,
                            products_desc: packageDetails.description,
                            hsn_code: '',
                            weight: packageDetails.weight.toString(),
                            quantity: '1',
                        },
                    ],
                    pickup_location: {
                        name: shipFromAddress.name,
                        add: this.formatAddress(shipFromAddress),
                        city: shipFromAddress.city,
                        pin: shipFromAddress.postal_code,
                        state: shipFromAddress.state,
                        country: shipFromAddress.country,
                        phone: shipFromAddress.phone,
                    },
                },
            };

            // Create the full shipment payload
            const shipment: any = payload.data.shipments[0];

            // Add dimensions if provided
            if (packageDetails.length && packageDetails.breadth && packageDetails.height) {
                shipment.dimensions = {
                    length: packageDetails.length.toString(),
                    breadth: packageDetails.breadth.toString(),
                    height: packageDetails.height.toString(),
                };
            }

            // Make API call to create shipment
            const response = await fetch(`${DELHIVERY_API_BASE}${ENDPOINTS.CREATE_SHIPMENT}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Token ${this.apiKey}`,
                },
                body: JSON.stringify(payload),
            });

            if (!response.ok) {
                throw new Error(`Delhivery API error: ${response.status} ${response.statusText}`);
            }

            const data = await response.json();
            return this.formatShipmentResponse(data);
        } catch (error) {
            console.error('Error creating Delhivery shipment:', error);
            return {
                success: false,
                waybill: '',
                reference: orderId,
                status: 'failed',
                errors: [error instanceof Error ? error.message : 'Unknown error'],
            };
        }
    }

    /**
     * Track a shipment by waybill number (tracking number)
     * @param waybill Tracking number / waybill
     */
    async trackShipment(waybill: string): Promise<DelhiveryTrackingResponse> {
        try {
            const response = await fetch(
                `${DELHIVERY_API_BASE}${ENDPOINTS.TRACK_SHIPMENT}?waybill=${waybill}&token=${this.apiKey}`,
                {
                    method: 'GET',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                }
            );

            if (!response.ok) {
                throw new Error(`Delhivery API error: ${response.status} ${response.statusText}`);
            }

            const data = await response.json();
            return this.formatTrackingResponse(data, waybill);
        } catch (error) {
            console.error('Error tracking Delhivery shipment:', error);
            return {
                success: false,
                tracking_data: {
                    track_id: waybill,
                    shipment_id: waybill,
                    status: 'error',
                    status_code: 'error',
                    status_description: 'Failed to retrieve tracking information',
                    last_update_date: new Date().toISOString(),
                    scans: [],
                },
                errors: [error instanceof Error ? error.message : 'Unknown error'],
            };
        }
    }

    /**
     * Cancel a shipment
     * @param waybill Tracking number / waybill
     */
    async cancelShipment(waybill: string): Promise<{ success: boolean; message: string }> {
        try {
            const payload = {
                waybill: waybill,
                cancellation: true,
            };

            const response = await fetch(`${DELHIVERY_API_BASE}${ENDPOINTS.CANCEL_SHIPMENT}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Token ${this.apiKey}`,
                },
                body: JSON.stringify(payload),
            });

            if (!response.ok) {
                throw new Error(`Delhivery API error: ${response.status} ${response.statusText}`);
            }

            const data = await response.json() as {
                success?: boolean;
                message?: string
            };
            return {
                success: data.success || false,
                message: data.message || 'Shipment cancellation request processed',
            };
        } catch (error) {
            console.error('Error cancelling Delhivery shipment:', error);
            return {
                success: false,
                message: error instanceof Error ? error.message : 'Unknown error occurred',
            };
        }
    }

    /**
     * Calculate shipping rates
     * @param fromPincode Origin pincode
     * @param toPincode Destination pincode
     * @param weight Package weight in kg
     */
    async calculateRate(
        fromPincode: string,
        toPincode: string,
        weight: number
    ): Promise<DelhiveryRateCalculationResponse> {
        try {
            const response = await fetch(
                `${DELHIVERY_API_BASE}${ENDPOINTS.CALCULATE_RATE}?` +
                `o_pin=${fromPincode}&d_pin=${toPincode}&weight=${weight}&token=${this.apiKey}`,
                {
                    method: 'GET',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                }
            );

            if (!response.ok) {
                throw new Error(`Delhivery API error: ${response.status} ${response.statusText}`);
            }

            const data = await response.json() as {
                rate?: number;
                expected_delivery_days?: number
            };
            return {
                success: true,
                rate: data.rate || 0,
                expected_delivery_days: data.expected_delivery_days || 5, // Default to 5 if not provided
                currency: 'INR',
            };
        } catch (error) {
            console.error('Error calculating Delhivery shipping rate:', error);
            return {
                success: false,
                rate: 0,
                expected_delivery_days: 0,
                currency: 'INR',
                errors: [error instanceof Error ? error.message : 'Unknown error'],
            };
        }
    }

    /**
     * Check if a pincode is serviceable
     * @param pincode Pincode to check
     */
    async checkPincodeServiceability(pincode: string): Promise<boolean> {
        try {
            const response = await fetch(
                `${DELHIVERY_API_BASE}${ENDPOINTS.PINCODES}?filter_codes=${pincode}&token=${this.apiKey}`,
                {
                    method: 'GET',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                }
            );

            if (!response.ok) {
                throw new Error(`Delhivery API error: ${response.status} ${response.statusText}`);
            }

            const data: DelhiveryPincodeResponse = await response.json();

            // Check if the pincode is serviceable
            if (data.success && data.delivery_codes && data.delivery_codes.length > 0) {
                return data.delivery_codes[0].serviceable || false;
            }

            return false;
        } catch (error) {
            console.error('Error checking Delhivery pincode serviceability:', error);
            return false;
        }
    }

    /**
     * Helper: Format address as a single string for Delhivery
     */
    private formatAddress(address: Address): string {
        const addressParts = [
            address.street_address || address.address_line1,
            address.apartment_number || address.address_line2,
            address.landmark,
            address.city,
            address.state,
            address.postal_code,
        ];

        // Filter out undefined or empty values and join with commas
        return addressParts.filter(part => part && part.trim().length > 0).join(', ');
    }

    /**
     * Helper: Format the shipment response from Delhivery
     */
    private formatShipmentResponse(data: any): DelhiveryShipmentResponse {
        // Handle different response formats from Delhivery API
        if (data.packages && Array.isArray(data.packages) && data.packages.length > 0) {
            const pkg = data.packages[0];
            return {
                success: true,
                waybill: pkg.waybill || '',
                reference: pkg.reference || '',
                status: pkg.status || 'created',
            };
        } else if (data.error) {
            return {
                success: false,
                waybill: '',
                reference: '',
                status: 'failed',
                errors: [data.error],
            };
        }

        return {
            success: false,
            waybill: '',
            reference: '',
            status: 'unknown',
            errors: ['Invalid response format from Delhivery'],
        };
    }

    /**
     * Helper: Format the tracking response from Delhivery
     */
    private formatTrackingResponse(data: any, waybill: string): DelhiveryTrackingResponse {
        if (data.ShipmentData && Array.isArray(data.ShipmentData) && data.ShipmentData.length > 0) {
            const shipmentData = data.ShipmentData[0];

            return {
                success: true,
                tracking_data: {
                    track_id: waybill,
                    shipment_id: shipmentData.Shipment.ReferenceNo || '',
                    status: shipmentData.Shipment.Status || '',
                    status_code: shipmentData.Shipment.StatusCode || '',
                    status_description: shipmentData.Shipment.StatusDescription || '',
                    last_update_date: shipmentData.Shipment.LastUpdate || new Date().toISOString(),
                    expected_delivery_date: shipmentData.Shipment.ExpectedDeliveryDate,
                    delivery_date: shipmentData.Shipment.DeliveryDate,
                    scans: Array.isArray(shipmentData.Scans)
                        ? shipmentData.Scans.map((scan: any) => ({
                            scan_type: scan.ScanType || '',
                            scan_date: scan.ScanDateTime || '',
                            scan_location: scan.ScannedLocation || '',
                            status_code: scan.StatusCode || '',
                            status_description: scan.Instructions || '',
                        }))
                        : [],
                },
            };
        }

        return {
            success: false,
            tracking_data: {
                track_id: waybill,
                shipment_id: '',
                status: 'unknown',
                status_code: 'unknown',
                status_description: 'No tracking data found',
                last_update_date: new Date().toISOString(),
                scans: [],
            },
            errors: ['No tracking data found'],
        };
    }
}