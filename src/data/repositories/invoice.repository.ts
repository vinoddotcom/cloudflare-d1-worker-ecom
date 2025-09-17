import { Env } from '../../models/common.model';
import { BaseRepository } from './base.repository';
import { Invoice, InvoiceStatus } from '../../models/order.model';

/**
 * Repository for invoice-related database operations
 */
export class InvoiceRepository extends BaseRepository<Invoice> {
    constructor(env: Env) {
        super(env.DB, 'invoices');
    }

    /**
     * Generate a unique invoice number
     * Format: INV-YYYYMMDD-XXXXX (where XXXXX is a random 5-digit number)
     */
    private generateInvoiceNumber(): string {
        const date = new Date();
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const random = Math.floor(Math.random() * 90000) + 10000; // 5-digit number
        return `INV-${year}${month}${day}-${random}`;
    }

    /**
     * Create a new invoice for an order
     * @param data Invoice data
     * @returns The created invoice
     */
    async createInvoice(data: {
        orderId: number;
        issueDate?: Date;
        dueDate?: Date;
    }): Promise<Invoice> {
        try {
            const now = new Date();
            const invoiceNumber = this.generateInvoiceNumber();

            const {
                orderId,
                issueDate = now,
                dueDate = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000), // Default: 30 days from now
            } = data;

            // Check if invoice already exists for this order
            const existingInvoice = await this.db.prepare(`
        SELECT id FROM invoices WHERE order_id = ?
      `).bind(orderId).first();

            if (existingInvoice) {
                throw new Error(`Invoice already exists for order ${orderId}`);
            }

            // Get order information for amount details
            const order = await this.db.prepare(`
        SELECT subtotal, shipping_fee, tax_amount, total_amount
        FROM orders
        WHERE id = ?
      `).bind(orderId).first();

            if (!order) {
                throw new Error(`Order with ID ${orderId} not found`);
            }

            // Create invoice
            const query = `
        INSERT INTO invoices (
          invoice_number,
          order_id,
          issue_date,
          due_date,
          status,
          amount,
          tax_amount,
          total_amount,
          created_at,
          updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;

            const nowTimestamp = Math.floor(now.getTime() / 1000);
            const issueDateTimestamp = Math.floor(issueDate.getTime() / 1000);
            const dueDateTimestamp = Math.floor(dueDate.getTime() / 1000);

            const result = await this.db.prepare(query).bind(
                invoiceNumber,
                orderId,
                issueDateTimestamp,
                dueDateTimestamp,
                'issued', // Default status
                order.subtotal + order.shipping_fee, // Amount excluding tax
                order.tax_amount,
                order.total_amount,
                nowTimestamp,
                nowTimestamp
            ).run();

            if (!result.success) {
                throw new Error('Failed to create invoice');
            }

            // Return the created invoice
            return this.getInvoiceByOrderId(orderId);
        } catch (error) {
            console.error('Error creating invoice:', error);
            throw error;
        }
    }

    /**
     * Get invoice by order ID
     * @param orderId Order ID
     * @returns Invoice information
     */
    async getInvoiceByOrderId(orderId: number): Promise<Invoice> {
        try {
            const invoice = await this.db.prepare(`
        SELECT * FROM invoices WHERE order_id = ?
      `).bind(orderId).first();

            if (!invoice) {
                throw new Error(`No invoice found for order ${orderId}`);
            }

            return invoice;
        } catch (error) {
            console.error('Error fetching invoice:', error);
            throw error;
        }
    }

    /**
     * Update invoice status
     * @param invoiceId Invoice ID
     * @param status New invoice status
     * @returns Updated invoice
     */
    async updateInvoiceStatus(
        invoiceId: number,
        status: InvoiceStatus
    ): Promise<Invoice> {
        try {
            const now = Math.floor(Date.now() / 1000);

            // Update invoice status
            await this.db.prepare(`
        UPDATE invoices
        SET status = ?, updated_at = ?
        WHERE id = ?
      `).bind(status, now, invoiceId.toString()).run();

            // If invoice is marked as paid, update the payment status if it exists
            if (status === 'paid') {
                const invoice = await this.findById(invoiceId.toString());
                if (invoice) {
                    await this.db.prepare(`
            UPDATE payments
            SET status = 'completed', updated_at = ?
            WHERE order_id = ? AND status = 'pending'
          `).bind(now, invoice.order_id).run();
                }
            }

            // Return the updated invoice
            return this.findById(invoiceId.toString()) as Promise<Invoice>;
        } catch (error) {
            console.error('Error updating invoice status:', error);
            throw error;
        }
    }

    /**
     * Generate a PDF invoice
     * In a real enterprise system, this would generate a proper PDF
     * For this example, we return HTML content that could be converted to PDF
     * @param invoiceId Invoice ID
     * @returns HTML content for the invoice
     */
    async generateInvoicePdf(invoiceId: number): Promise<string> {
        try {
            // Get invoice with related data
            const invoice = await this.findById(invoiceId.toString());
            if (!invoice) {
                throw new Error(`Invoice with ID ${invoiceId} not found`);
            }

            // Get order details
            const order = await this.db.prepare(`
        SELECT 
          o.*,
          u.email as user_email,
          u.first_name as user_first_name,
          u.last_name as user_last_name
        FROM orders o
        JOIN users u ON o.user_id = u.id
        WHERE o.id = ?
      `).bind(invoice.order_id).first();

            if (!order) {
                throw new Error(`Order with ID ${invoice.order_id} not found`);
            }

            // Get order items
            const items = await this.db.prepare(`
        SELECT * FROM order_items WHERE order_id = ?
      `).bind(invoice.order_id).all();

            // Get addresses
            const addresses = await this.db.prepare(`
        SELECT 
          a.*,
          CASE WHEN a.id = ? THEN 'shipping' WHEN a.id = ? THEN 'billing' END as address_type
        FROM addresses a
        WHERE a.id IN (?, ?)
      `).bind(
                order.shipping_address_id,
                order.billing_address_id,
                order.shipping_address_id,
                order.billing_address_id
            ).all();

            // In a real system, you would use a proper template engine
            // Here we generate simple HTML
            const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <title>Invoice ${invoice.invoice_number}</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 0; padding: 0; }
            .invoice-container { max-width: 800px; margin: 0 auto; padding: 20px; }
            .invoice-header { border-bottom: 1px solid #ddd; padding-bottom: 20px; display: flex; justify-content: space-between; }
            .invoice-company { font-weight: bold; font-size: 24px; }
            .invoice-details { margin-top: 20px; display: flex; justify-content: space-between; }
            .invoice-customer { flex: 1; }
            .invoice-info { flex: 1; text-align: right; }
            .invoice-items { margin-top: 40px; }
            table { width: 100%; border-collapse: collapse; }
            th, td { padding: 10px; text-align: left; border-bottom: 1px solid #ddd; }
            th { background-color: #f2f2f2; }
            .text-right { text-align: right; }
            .invoice-total { margin-top: 20px; text-align: right; }
            .invoice-total table { width: 300px; margin-left: auto; }
            .invoice-footer { margin-top: 40px; text-align: center; color: #888; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="invoice-container">
            <div class="invoice-header">
              <div class="invoice-company">
                Your Company Name
              </div>
              <div>
                <h1>INVOICE</h1>
                <p>${invoice.invoice_number}</p>
              </div>
            </div>
            
            <div class="invoice-details">
              <div class="invoice-customer">
                <h3>Bill To:</h3>
                <p>
                  ${order.user_first_name} ${order.user_last_name}<br>
                  ${order.user_email}<br>
                  ${this.formatAddress(addresses.results.find((a: any) => a.address_type === 'billing'))}
                </p>
              </div>
              <div class="invoice-info">
                <h3>Invoice Details:</h3>
                <p>
                  Issue Date: ${new Date(invoice.issue_date * 1000).toLocaleDateString()}<br>
                  Due Date: ${new Date(invoice.due_date * 1000).toLocaleDateString()}<br>
                  Status: ${invoice.status}<br>
                  Order #: ${order.order_number}
                </p>
              </div>
            </div>
            
            <div class="invoice-items">
              <table>
                <thead>
                  <tr>
                    <th>Description</th>
                    <th>SKU</th>
                    <th>Quantity</th>
                    <th class="text-right">Price</th>
                    <th class="text-right">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  ${items.results.map((item: any) => `
                    <tr>
                      <td>${item.product_name} - ${item.variant_name}</td>
                      <td>${item.sku}</td>
                      <td>${item.quantity}</td>
                      <td class="text-right">$${item.price.toFixed(2)}</td>
                      <td class="text-right">$${(item.price * item.quantity).toFixed(2)}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
            
            <div class="invoice-total">
              <table>
                <tr>
                  <td>Subtotal:</td>
                  <td class="text-right">$${order.subtotal.toFixed(2)}</td>
                </tr>
                <tr>
                  <td>Shipping:</td>
                  <td class="text-right">$${order.shipping_fee.toFixed(2)}</td>
                </tr>
                <tr>
                  <td>Tax:</td>
                  <td class="text-right">$${order.tax_amount.toFixed(2)}</td>
                </tr>
                <tr>
                  <td><strong>Total:</strong></td>
                  <td class="text-right"><strong>$${order.total_amount.toFixed(2)}</strong></td>
                </tr>
              </table>
            </div>
            
            <div class="invoice-footer">
              <p>Thank you for your business! Payment is due by the due date.</p>
              <p>Questions? Contact our support at support@yourcompany.com</p>
            </div>
          </div>
        </body>
        </html>
      `;

            return html;
        } catch (error) {
            console.error('Error generating invoice PDF:', error);
            throw error;
        }
    }

    /**
     * Format an address object into a readable string
     */
    private formatAddress(address: any): string {
        if (!address) return 'Address not available';

        return `
      ${address.address_line1}<br>
      ${address.address_line2 ? address.address_line2 + '<br>' : ''}
      ${address.city}, ${address.state} ${address.postal_code}<br>
      ${address.country}
    `.trim();
    }
}