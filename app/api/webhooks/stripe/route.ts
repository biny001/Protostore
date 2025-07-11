import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { updateOrderToPaid } from '@/lib/actions/order.actions';

export async function POST(req: NextRequest) {
  try {
    // Build the webhook event
    const event = await Stripe.webhooks.constructEvent(
      await req.text(),
      req.headers.get('stripe-signature') as string,
      process.env.STRIPE_WEBHOOK_SECRET as string
    );

    console.log('Webhook received:', event.type);

    // Check for successful payment intent
    if (event.type === 'payment_intent.succeeded') {
      const paymentIntent = event.data.object as Stripe.PaymentIntent;
      console.log('Payment intent succeeded:', paymentIntent.id, paymentIntent.metadata);

      if (paymentIntent.metadata.orderId) {
        await updateOrderToPaid({
          orderId: paymentIntent.metadata.orderId,
          paymentResult: {
            id: paymentIntent.id,
            status: 'COMPLETED',
            email_address: paymentIntent.receipt_email || '',
            pricePaid: (paymentIntent.amount_received / 100).toFixed(),
          },
        });

        console.log('Order updated to paid for orderId:', paymentIntent.metadata.orderId);

        return NextResponse.json({
          message: 'Order marked as paid via payment_intent.succeeded',
        });
      }
    }

    // Check for successful charge
    if (event.type === 'charge.succeeded') {
      const charge = event.data.object as Stripe.Charge;
      console.log('Charge succeeded:', charge.id, charge.metadata);

      if (charge.metadata.orderId) {
        await updateOrderToPaid({
          orderId: charge.metadata.orderId,
          paymentResult: {
            id: charge.id,
            status: 'COMPLETED',
            email_address: charge.billing_details.email || '',
            pricePaid: (charge.amount / 100).toFixed(),
          },
        });

        console.log('Order updated to paid for orderId:', charge.metadata.orderId);

        return NextResponse.json({
          message: 'Order marked as paid via charge.succeeded',
        });
      }
    }

    return NextResponse.json({
      message: `Unhandled event type: ${event.type}`,
    });
  } catch (error) {
    console.error('Webhook error:', error);
    return NextResponse.json(
      { error: 'Webhook handler failed' },
      { status: 400 }
    );
  }
}
