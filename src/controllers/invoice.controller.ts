import { IRequest } from 'itty-router';
import { Env } from '../models/common.model';
import { AuthRequest } from '../middleware/auth';
import { errorResponse, successResponse } from '../utils/response';
import { InvoiceRepository } from '../data/repositories/invoice.repository';
import { OrderRepository } from '../data/repositories/order.repository';

/**
 * Controller for invoice-related operations
 */
export class InvoiceController {
    private invoiceRepository: InvoiceRepository;
    private orderRepository: OrderRepository;

    constructor(private env: Env) {
        this.invoiceRepository = new InvoiceRepository(env);
        this.orderRepository = new OrderRepository(env);
    }

    /**
     * Generate an invoice for an order
     */
    async generateInvoice(request: AuthRequest): Promise<Response> {
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

            // Check if the order has a completed payment
            if (!order.payment || order.payment.status !== 'completed') {
                return errorResponse('Cannot generate invoice: payment not completed', 400);
            }

            // Check if invoice already exists for this order
            let invoice;
            try {
                invoice = await this.invoiceRepository.getInvoiceByOrderId(orderIdNumber);
                if (invoice) {
                    return successResponse({
                        message: 'Invoice already exists',
                        invoice,
                    });
                }
            } catch (error) {
                // No invoice exists, continue with generation
            }

            // Generate the invoice
            invoice = await this.invoiceRepository.createInvoice({
                orderId: orderIdNumber,
                issueDate: new Date(),
                dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // Due in 30 days
            });

            return successResponse({
                message: 'Invoice generated successfully',
                invoice,
            });
        } catch (error) {
            console.error('Error generating invoice:', error);
            return errorResponse(error instanceof Error ? error.message : 'Failed to generate invoice', 500);
        }
    }

    /**
     * Get invoice by ID
     */
    async getInvoiceById(request: AuthRequest): Promise<Response> {
        try {
            const invoiceId = request.params?.id;
            if (!invoiceId) {
                return errorResponse('Invoice ID is required', 400);
            }

            const invoiceIdNumber = parseInt(invoiceId);
            if (isNaN(invoiceIdNumber)) {
                return errorResponse('Invalid invoice ID', 400);
            }

            // Get the invoice
            const invoice = await this.invoiceRepository.findById(invoiceId);
            if (!invoice) {
                return errorResponse('Invoice not found', 404);
            }

            // Get the order to check if the invoice belongs to the user
            const order = await this.orderRepository.getOrderById(invoice.order_id);

            // Check if the order belongs to the user (unless the user is an admin)
            if (order.user_id !== request.userId && request.userRole !== 'admin') {
                return errorResponse('Unauthorized', 403);
            }

            return successResponse(invoice);
        } catch (error) {
            console.error('Error fetching invoice:', error);
            return errorResponse(error instanceof Error ? error.message : 'Failed to fetch invoice', 500);
        }
    }

    /**
     * Get invoice by order ID
     */
    async getInvoiceByOrderId(request: AuthRequest): Promise<Response> {
        try {
            const orderId = request.params?.orderId;
            if (!orderId) {
                return errorResponse('Order ID is required', 400);
            }

            const orderIdNumber = parseInt(orderId);
            if (isNaN(orderIdNumber)) {
                return errorResponse('Invalid order ID', 400);
            }

            // Get the order to check access
            const order = await this.orderRepository.getOrderById(orderIdNumber);

            // Check if the order belongs to the user (unless the user is an admin)
            if (order.user_id !== request.userId && request.userRole !== 'admin') {
                return errorResponse('Unauthorized', 403);
            }

            // Get the invoice
            const invoice = await this.invoiceRepository.getInvoiceByOrderId(orderIdNumber);
            if (!invoice) {
                return errorResponse('Invoice not found for this order', 404);
            }

            return successResponse(invoice);
        } catch (error) {
            console.error('Error fetching invoice:', error);
            return errorResponse(error instanceof Error ? error.message : 'Failed to fetch invoice', 500);
        }
    }

    /**
     * Get all invoices for a user
     */
    async getUserInvoices(request: AuthRequest): Promise<Response> {
        try {
            // Get the user ID from the authenticated request
            const userId = request.userId;
            if (!userId) {
                return errorResponse('User ID not found in request', 400);
            }

            // Query database directly for invoices associated with this user's orders
            const query = `
        SELECT i.*
        FROM invoices i
        JOIN orders o ON i.order_id = o.id
        WHERE o.user_id = ?
        ORDER BY i.created_at DESC
      `;

            const { results: invoices } = await this.env.DB.prepare(query).bind(userId).all();

            return successResponse(invoices || []);
        } catch (error) {
            console.error('Error fetching user invoices:', error);
            return errorResponse(error instanceof Error ? error.message : 'Failed to fetch user invoices', 500);
        }
    }

    /**
     * Update invoice status (admin only)
     */
    async updateInvoiceStatus(request: AuthRequest): Promise<Response> {
        try {
            // Check if user is admin
            if (request.userRole !== 'admin') {
                return errorResponse('Unauthorized: Admin access required', 403);
            }

            const invoiceId = request.params?.id;
            if (!invoiceId) {
                return errorResponse('Invoice ID is required', 400);
            }

            const invoiceIdNumber = parseInt(invoiceId);
            if (isNaN(invoiceIdNumber)) {
                return errorResponse('Invalid invoice ID', 400);
            }

            const data = await request.json() as { status: string };
            const { status } = data;

            if (!status || !['issued', 'paid', 'cancelled', 'refunded'].includes(status)) {
                return errorResponse('Invalid status. Must be one of: issued, paid, cancelled, refunded', 400);
            }

            // Convert to the correct type for the repository
            const invoiceStatus = status as 'issued' | 'paid' | 'cancelled' | 'refunded';

            // Update the invoice status
            await this.invoiceRepository.updateInvoiceStatus(invoiceIdNumber, invoiceStatus);

            // Get the updated invoice
            const updatedInvoice = await this.invoiceRepository.findById(invoiceId);

            return successResponse({
                message: 'Invoice status updated successfully',
                invoice: updatedInvoice,
            });
        } catch (error) {
            console.error('Error updating invoice status:', error);
            return errorResponse(error instanceof Error ? error.message : 'Failed to update invoice status', 500);
        }
    }

    /**
     * Download invoice as PDF (HTML format)
     */
    async downloadInvoicePdf(request: AuthRequest): Promise<Response> {
        try {
            const invoiceId = request.params?.id;
            if (!invoiceId) {
                return errorResponse('Invoice ID is required', 400);
            }

            const invoiceIdNumber = parseInt(invoiceId);
            if (isNaN(invoiceIdNumber)) {
                return errorResponse('Invalid invoice ID', 400);
            }

            // Get the invoice
            const invoice = await this.invoiceRepository.findById(invoiceId);
            if (!invoice) {
                return errorResponse('Invoice not found', 404);
            }

            // Get the order to check if the invoice belongs to the user
            const order = await this.orderRepository.getOrderById(invoice.order_id);

            // Check if the order belongs to the user (unless the user is an admin)
            if (order.user_id !== request.userId && request.userRole !== 'admin') {
                return errorResponse('Unauthorized', 403);
            }

            // Generate the PDF content (HTML)
            const pdfContent = await this.invoiceRepository.generateInvoicePdf(invoiceIdNumber);

            // In a real system, you would convert this to PDF and set appropriate headers
            // Since Cloudflare Workers doesn't support PDF generation directly, we're returning HTML

            return new Response(pdfContent, {
                headers: {
                    'Content-Type': 'text/html',
                    'Content-Disposition': `inline; filename="invoice-${invoice.invoice_number}.html"`
                }
            });
        } catch (error) {
            console.error('Error generating invoice PDF:', error);
            return errorResponse(error instanceof Error ? error.message : 'Failed to generate invoice PDF', 500);
        }
    }
}