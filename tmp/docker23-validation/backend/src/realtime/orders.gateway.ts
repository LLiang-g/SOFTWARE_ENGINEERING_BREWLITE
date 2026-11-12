import { WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import type { Namespace } from 'socket.io';

@WebSocketGateway({
    namespace: '/orders-live',
    transports: ['websocket'],
    cors: { origin: process.env.FRONTEND_URL ?? 'http://localhost:3000' },
})
export class OrdersGateway {
    @WebSocketServer()
    private server?: Namespace;

    notifyOrdersChanged() {
        // Không đưa đơn/tài khoản lên kênh chung. Client gọi lại API của mình.
        this.server?.emit('orders.changed');
    }
}
