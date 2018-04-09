/// <reference path="../../remote-checkout/methods/afterpay/afterpay-sdk.d.ts" />
import { omit } from 'lodash';

import { CheckoutSelectors, CheckoutStore } from '../../checkout';
import { OrderRequestBody, PlaceOrderService } from '../../order';
import { RemoteCheckoutActionCreator } from '../../remote-checkout';
import AfterpayScriptLoader from '../../remote-checkout/methods/afterpay';
import { PaymentMethodMissingDataError, PaymentMethodUninitializedError } from '../errors';

import PaymentStrategy, { InitializeOptions } from './payment-strategy';

export default class AfterpayPaymentStrategy extends PaymentStrategy {
    private _afterpaySdk?: Afterpay.Sdk;

    constructor(
        store: CheckoutStore,
        placeOrderService: PlaceOrderService,
        private _remoteCheckoutActionCreator: RemoteCheckoutActionCreator,
        private _afterpayScriptLoader: AfterpayScriptLoader
    ) {
        super(store, placeOrderService);
    }

    initialize(options: InitializeOptions): Promise<CheckoutSelectors> {
        if (this._isInitialized) {
            return super.initialize(options);
        }

        return this._afterpayScriptLoader.load(options.paymentMethod)
            .then((afterpaySdk) => {
                this._afterpaySdk = afterpaySdk;
            })
            .then(() => super.initialize(options));
    }

    deinitialize(options: any): Promise<CheckoutSelectors> {
        if (!this._isInitialized) {
            return super.deinitialize(options);
        }

        if (this._afterpaySdk) {
            this._afterpaySdk = undefined;
        }

        return super.deinitialize(options);
    }

    execute(payload: OrderRequestBody, options?: any): Promise<CheckoutSelectors> {
        const paymentId = payload.payment.gateway;
        const useStoreCredit = !!payload.useStoreCredit;
        const customerMessage = payload.customerMessage ? payload.customerMessage : '';

        if (!paymentId) {
            throw new PaymentMethodMissingDataError('gateway');
        }

        return this._store.dispatch(
            this._remoteCheckoutActionCreator.initializePayment(paymentId, { useStoreCredit, customerMessage })
        )
            .then(() => this._placeOrderService.verifyCart())
            .then(() => this._placeOrderService.loadPaymentMethod(paymentId))
            .then((resp: any) => this._displayModal(resp.checkout.getPaymentMethod(paymentId).clientToken))
            // Afterpay will handle the rest of the flow so return a promise that doesn't really resolve
            .then(() => new Promise<never>(() => {}));
    }

    finalize(options: any): Promise<CheckoutSelectors> {
        const { checkout } = this._store.getState();
        const { useStoreCredit, customerMessage } = checkout.getCustomer().remote;
        const order = checkout.getOrder();

        const payload = {
            payment: {
                name: order.payment.id,
                paymentData: { nonce: options.nonce },
            },
        };

        return this._placeOrderService.submitOrder({ useStoreCredit, customerMessage }, true, options)
            .then(() =>
                this._placeOrderService.submitPayment(payload.payment, useStoreCredit, omit(options, 'nonce'))
            );
    }

    /**
     * @param token the token returned by afterpay API
     */
    private _displayModal(token: string): void {
        if (!this._afterpaySdk || !token) {
            throw new PaymentMethodUninitializedError('afterpay');
        }

        this._afterpaySdk.init();
        this._afterpaySdk.display({ token });
    }
}
