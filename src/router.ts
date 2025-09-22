import { Router, IRequest } from 'itty-router';
import { Env } from './models/common.model';
import { authenticate, authorize, AuthRequest } from './middleware/auth';
import { requestLogger } from './middleware/logger';
import { UserController } from './controllers/user.controller';
import { AuthController } from './controllers/auth.controller';
import { ProductController } from './controllers/product.controller';
import { CartController } from './controllers/cart.controller';
import { OrderController } from './controllers/order.controller';
import { PaymentController } from './controllers/payment.controller';
import { InvoiceController } from './controllers/invoice.controller';
import { ShippingController } from './controllers/shipping.controller';
import { WebhookController } from './controllers/webhook.controller';
import { ImageController } from './controllers/image.controller';
import { AddressController } from './controllers/address.controller';
import { BlogController } from './controllers/blog.controller';
import { ProductAttributeController } from './controllers/product-attribute.controller';
import { ProductVariantController } from './controllers/product-variant.controller';
import { InventoryController } from './controllers/inventory.controller';
import { ProductCategoryController } from './controllers/product-category.controller';
import { UserRole } from './models/user.model';
import { AddressCreateSchema, AddressUpdateSchema } from './models/address.model';
import { validateRequest } from './middleware/validator';

/**
 * Configure API routes with authentication and authorization
 * @param env Environment variables
 */
export function setupApiRoutes(env: Env): Router<Request> {
    // Create a new router
    const router = Router<Request>();
    
    // Initialize controllers
    const userController = new UserController(env);
    const authController = new AuthController(env);
    const productController = new ProductController(env);
    const cartController = new CartController(env);
    const orderController = new OrderController(env);
    const paymentController = new PaymentController(env);
    const invoiceController = new InvoiceController(env);
    const shippingController = new ShippingController(env);
    const webhookController = new WebhookController(env);
    const imageController = new ImageController(env);
    const addressController = new AddressController(env);
    const blogController = new BlogController(env);
    const productAttributeController = new ProductAttributeController(env);
    const inventoryController = new InventoryController(env);
    const productVariantController = new ProductVariantController(env);
    const productCategoryController = new ProductCategoryController(env);

    // Apply global middleware
    router.all('*', requestLogger());

    // Public routes (no authentication required)
    // Health check endpoint
    router.get('/api/v1/health', () => {
        return new Response(
            JSON.stringify({
                success: true,
                data: {
                    status: 'ok',
                    version: '1.0.0',
                    timestamp: Date.now(),
                },
            }),
            {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
            }
        );
    });

    // Auth routes
    router.post('/api/v1/auth/verify', (request: IRequest, env: Env) => authController.verifyToken(request, env));

    // User routes
    router.get('/api/v1/users/me', authenticate(env), (request: IRequest) => userController.getCurrentUser(request as AuthRequest));
    router.get('/api/v1/users', authenticate(env), authorize([UserRole.ADMIN]), (request: IRequest) => userController.getAllUsers(request as AuthRequest));
    router.get('/api/v1/users/:id', authenticate(env), (request: IRequest) => userController.getUserById(request as AuthRequest));
    router.put('/api/v1/users/:id', authenticate(env), (request: IRequest) => userController.updateUser(request as AuthRequest));
    router.delete('/api/v1/users/:id', authenticate(env), (request: IRequest) => userController.deleteUser(request as AuthRequest));

    // Product routes
    router.get('/api/v1/products', (request: IRequest) => productController.getAllProducts(request));
    router.get('/api/v1/products/:id', (request: IRequest) => productController.getProductById(request));
    router.get('/api/v1/products/categories', (request: IRequest) => productController.getProductCategories(request));
    router.post('/api/v1/products', authenticate(env), authorize([UserRole.ADMIN]), (request: IRequest) => productController.createProduct(request as AuthRequest));
    router.put('/api/v1/products/:id', authenticate(env), authorize([UserRole.ADMIN]), (request: IRequest) => productController.updateProduct(request as AuthRequest));
    router.delete('/api/v1/products/:id', authenticate(env), authorize([UserRole.ADMIN]), (request: IRequest) => productController.deleteProduct(request as AuthRequest));

    // Cart routes (authenticated)
    router.get('/api/v1/cart', authenticate(env), (request: IRequest) => cartController.getCart(request as AuthRequest));
    router.post('/api/v1/cart/items', authenticate(env), (request: IRequest) => cartController.addToCart(request as AuthRequest));
    router.put('/api/v1/cart/items/:id', authenticate(env), (request: IRequest) => cartController.updateCartItem(request as AuthRequest));
    router.delete('/api/v1/cart/items/:id', authenticate(env), (request: IRequest) => cartController.removeCartItem(request as AuthRequest));
    router.delete('/api/v1/cart', authenticate(env), (request: IRequest) => cartController.clearCart(request as AuthRequest));
    router.post('/api/v1/cart/coupon', authenticate(env), (request: IRequest) => cartController.applyCoupon(request as AuthRequest));

    // Order routes
    router.get('/api/v1/orders', authenticate(env), (request: IRequest) => orderController.getUserOrders(request as AuthRequest));
    router.get('/api/v1/orders/:id', authenticate(env), (request: IRequest) => orderController.getOrderById(request as AuthRequest));
    router.post('/api/v1/orders', authenticate(env), (request: IRequest) => orderController.createOrder(request as AuthRequest));
    router.put('/api/v1/orders/:id/status', authenticate(env), authorize([UserRole.ADMIN]), (request: IRequest) => orderController.updateOrderStatus(request as AuthRequest));
    router.post('/api/v1/orders/:id/cancel', authenticate(env), (request: IRequest) => orderController.cancelOrder(request as AuthRequest));
    router.post('/api/v1/orders/:id/invoice', authenticate(env), (request: IRequest) => orderController.generateInvoice(request as AuthRequest));
    router.get('/api/v1/admin/orders', authenticate(env), authorize([UserRole.ADMIN]), (request: IRequest) => orderController.getAllOrders(request as AuthRequest));

    // Payment routes
    router.post('/api/v1/payments/process', authenticate(env), (request: IRequest) => paymentController.processPayment(request as AuthRequest));
    router.get('/api/v1/orders/:orderId/payment', authenticate(env), (request: IRequest) => paymentController.getPaymentByOrderId(request as AuthRequest));
    router.put('/api/v1/payments/:id/refund', authenticate(env), authorize([UserRole.ADMIN]), (request: IRequest) => paymentController.refundPayment(request as AuthRequest));
    router.put('/api/v1/payments/:id/status', authenticate(env), authorize([UserRole.ADMIN]), (request: IRequest) => paymentController.updatePaymentStatus(request as AuthRequest));

    // Webhook routes (no authentication required - secured by signatures)
    router.post('/api/v1/webhooks/razorpay', (request: IRequest) => webhookController.handleRazorpayWebhook(request));

    // Invoice routes
    router.post('/api/v1/orders/:orderId/invoice', authenticate(env), (request: IRequest) => invoiceController.generateInvoice(request as AuthRequest));
    router.get('/api/v1/invoices/:id', authenticate(env), (request: IRequest) => invoiceController.getInvoiceById(request as AuthRequest));
    router.get('/api/v1/orders/:orderId/invoice', authenticate(env), (request: IRequest) => invoiceController.getInvoiceByOrderId(request as AuthRequest));
    router.get('/api/v1/invoices', authenticate(env), (request: IRequest) => invoiceController.getUserInvoices(request as AuthRequest));
    router.get('/api/v1/invoices/:id/pdf', authenticate(env), (request: IRequest) => invoiceController.downloadInvoicePdf(request as AuthRequest));
    router.put('/api/v1/invoices/:id/status', authenticate(env), authorize([UserRole.ADMIN]), (request: IRequest) => invoiceController.updateInvoiceStatus(request as AuthRequest));

    // Shipping routes
    router.get('/api/v1/shipping/methods', (request: IRequest) => shippingController.getShippingMethods(request));
    router.post('/api/v1/shipping/methods', authenticate(env), authorize([UserRole.ADMIN]), (request: IRequest) => shippingController.createShippingMethod(request as AuthRequest));
    router.put('/api/v1/shipping/methods/:id', authenticate(env), authorize([UserRole.ADMIN]), (request: IRequest) => shippingController.updateShippingMethod(request as AuthRequest));
    router.get('/api/v1/orders/:orderId/shipping', authenticate(env), (request: IRequest) => shippingController.getOrderShippingStatus(request as AuthRequest));
    router.put('/api/v1/orders/:orderId/shipping', authenticate(env), authorize([UserRole.ADMIN]), (request: IRequest) => shippingController.updateOrderShippingStatus(request as AuthRequest));
    router.post('/api/v1/shipping/calculate', (request: IRequest) => shippingController.calculateShippingCost(request));
    router.post('/api/v1/orders/:orderId/shipping/label', authenticate(env), authorize([UserRole.ADMIN]), (request: IRequest) => shippingController.generateShippingLabel(request as AuthRequest));
    router.get('/api/v1/shipping/track/:trackingNumber', (request: IRequest) => shippingController.trackShipment(request));

    // Image routes
    router.get('/api/v1/images/:id', (request: IRequest) => imageController.getImage(request));
    router.get('/api/v1/images/:id/:variant', (request: IRequest) => imageController.getImageVariant(request));
    router.get('/api/v1/images/upload-url', authenticate(env), (request: IRequest) => imageController.getDirectUploadUrl(request as AuthRequest));
    router.post('/api/v1/images/upload', authenticate(env), (request: IRequest) => imageController.uploadImage(request as AuthRequest));
    router.delete('/api/v1/images/:id', authenticate(env), (request: IRequest) => imageController.deleteImage(request as AuthRequest));
    router.get('/api/v1/images', authenticate(env), authorize([UserRole.ADMIN]), (request: IRequest) => imageController.listImages(request as AuthRequest));

// Address validation imports already added at the top

// ...

    // Address routes
    router.get('/api/v1/addresses', authenticate(env), (request: IRequest) => addressController.getUserAddresses(request as AuthRequest));
    router.get('/api/v1/addresses/:id', authenticate(env), (request: IRequest) => addressController.getAddressById(request as AuthRequest));
    router.post('/api/v1/addresses', authenticate(env), validateRequest(AddressCreateSchema), (request: IRequest) => addressController.createAddress(request as AuthRequest));
    router.put('/api/v1/addresses/:id', authenticate(env), validateRequest(AddressUpdateSchema), (request: IRequest) => addressController.updateAddress(request as AuthRequest));
    router.delete('/api/v1/addresses/:id', authenticate(env), (request: IRequest) => addressController.deleteAddress(request as AuthRequest));
    router.get('/api/v1/addresses/default/:type', authenticate(env), (request: IRequest) => addressController.getDefaultAddress(request as AuthRequest));
    router.put('/api/v1/addresses/:id/default', authenticate(env), (request: IRequest) => addressController.setDefaultAddress(request as AuthRequest));
// ...

    // Blog routes
    // Categories
    router.get('/api/v1/blog/categories', () => blogController.getAllCategories());
    router.get('/api/v1/blog/categories/:id', (request: IRequest) => blogController.getCategoryById(request));
    router.post('/api/v1/blog/categories', authenticate(env), authorize([UserRole.ADMIN]), (request: IRequest) => blogController.createCategory(request as AuthRequest));
    router.put('/api/v1/blog/categories/:id', authenticate(env), authorize([UserRole.ADMIN]), (request: IRequest) => blogController.updateCategory(request as AuthRequest));
    router.delete('/api/v1/blog/categories/:id', authenticate(env), authorize([UserRole.ADMIN]), (request: IRequest) => blogController.deleteCategory(request as AuthRequest));

    // Posts
    router.get('/api/v1/blog/posts', (request: IRequest) => blogController.listPosts(request));
    router.get('/api/v1/blog/posts/:id', (request: IRequest) => blogController.getPostById(request));
    router.get('/api/v1/blog/posts/slug/:slug', (request: IRequest) => blogController.getPostBySlug(request));
    router.post('/api/v1/blog/posts', authenticate(env), authorize([UserRole.ADMIN]), (request: IRequest) => blogController.createPost(request as AuthRequest));
    router.put('/api/v1/blog/posts/:id', authenticate(env), authorize([UserRole.ADMIN]), (request: IRequest) => blogController.updatePost(request as AuthRequest));
    router.delete('/api/v1/blog/posts/:id', authenticate(env), authorize([UserRole.ADMIN]), (request: IRequest) => blogController.deletePost(request as AuthRequest));
    router.put('/api/v1/blog/posts/:id/status', authenticate(env), authorize([UserRole.ADMIN]), (request: IRequest) => blogController.updatePostStatus(request as AuthRequest));

    // Product Attributes routes
    router.get('/api/v1/admin/product-attributes', authenticate(env), authorize([UserRole.ADMIN]), (request: IRequest) => productAttributeController.getAllAttributes(request as AuthRequest));
    router.get('/api/v1/admin/product-attributes/:id', authenticate(env), authorize([UserRole.ADMIN]), (request: IRequest) => productAttributeController.getAttribute(request as AuthRequest));
    router.post('/api/v1/admin/product-attributes', authenticate(env), authorize([UserRole.ADMIN]), (request: IRequest) => productAttributeController.createAttribute(request as AuthRequest));
    router.put('/api/v1/admin/product-attributes/:id', authenticate(env), authorize([UserRole.ADMIN]), (request: IRequest) => productAttributeController.updateAttribute(request as AuthRequest));
    router.delete('/api/v1/admin/product-attributes/:id', authenticate(env), authorize([UserRole.ADMIN]), (request: IRequest) => productAttributeController.deleteAttribute(request as AuthRequest));

    // Inventory Management routes
    router.get('/api/v1/admin/inventory', authenticate(env), authorize([UserRole.ADMIN]), (request: IRequest) => inventoryController.getAllInventory(request as AuthRequest));
    router.put('/api/v1/admin/inventory/:variantId', authenticate(env), authorize([UserRole.ADMIN]), (request: IRequest) => inventoryController.updateInventory(request as AuthRequest));
    router.post('/api/v1/admin/inventory/bulk', authenticate(env), authorize([UserRole.ADMIN]), (request: IRequest) => inventoryController.bulkUpdateInventory(request as AuthRequest));

    // Product Variants routes
    router.get('/api/v1/admin/products/:productId/variants', authenticate(env), authorize([UserRole.ADMIN]), (request: IRequest) => productVariantController.getProductVariants(request as AuthRequest));
    router.post('/api/v1/admin/products/:productId/variants', authenticate(env), authorize([UserRole.ADMIN]), (request: IRequest) => productVariantController.createProductVariant(request as AuthRequest));
    router.put('/api/v1/admin/products/:productId/variants/:id', authenticate(env), authorize([UserRole.ADMIN]), (request: IRequest) => productVariantController.updateProductVariant(request as AuthRequest));
    router.delete('/api/v1/admin/products/:productId/variants/:id', authenticate(env), authorize([UserRole.ADMIN]), (request: IRequest) => productVariantController.deleteProductVariant(request as AuthRequest));

    // Product Categories Admin routes
    router.post('/api/v1/admin/product-categories', authenticate(env), authorize([UserRole.ADMIN]), (request: IRequest) => productCategoryController.createProductCategory(request as AuthRequest));
    router.put('/api/v1/admin/product-categories/:id', authenticate(env), authorize([UserRole.ADMIN]), (request: IRequest) => productCategoryController.updateProductCategory(request as AuthRequest));
    router.delete('/api/v1/admin/product-categories/:id', authenticate(env), authorize([UserRole.ADMIN]), (request: IRequest) => productCategoryController.deleteProductCategory(request as AuthRequest));

    return router;
}
