import { combineReducers } from '@bigcommerce/data-store';

import { BillingAddressAction, BillingAddressActionType } from '../billing/billing-address-actions';
import { CheckoutAction, CheckoutActionType } from '../checkout';
import { CustomerAction, CustomerActionType } from '../customer';
import { ConsignmentAction, ConsignmentActionType } from '../shipping/consignment-actions';

import InternalQuote from './internal-quote';
import mapToInternalQuote from './map-to-internal-quote';
import QuoteState, { QuoteErrorsState, QuoteStatusesState } from './quote-state';

const DEFAULT_STATE: QuoteState = {
    errors: {},
    meta: {},
    statuses: {},
};

export default function quoteReducer(
    state: QuoteState = DEFAULT_STATE,
    action: BillingAddressAction | CheckoutAction | ConsignmentAction | CustomerAction
): QuoteState {
    const reducer = combineReducers<QuoteState>({
        data: dataReducer,
        errors: errorsReducer,
        statuses: statusesReducer,
    });

    return reducer(state, action);
}

function dataReducer(
    data: InternalQuote | undefined,
    action: BillingAddressAction | CheckoutAction | ConsignmentAction | CustomerAction
): InternalQuote | undefined {
    switch (action.type) {
    case BillingAddressActionType.UpdateBillingAddressSucceeded:
    case CheckoutActionType.LoadCheckoutSucceeded:
    case ConsignmentActionType.CreateConsignmentsSucceeded:
    case ConsignmentActionType.UpdateConsignmentSucceeded:
        return action.payload ? { ...data, ...mapToInternalQuote(action.payload) } : data;

    case CustomerActionType.SignInCustomerSucceeded:
    case CustomerActionType.SignOutCustomerSucceeded:
        return action.payload ? { ...data, ...action.payload.quote } : data;

    default:
        return data;
    }
}

function errorsReducer(
    errors: QuoteErrorsState = DEFAULT_STATE.errors,
    action: BillingAddressAction | CheckoutAction
): QuoteErrorsState {
    switch (action.type) {
    case CheckoutActionType.LoadCheckoutRequested:
    case CheckoutActionType.LoadCheckoutSucceeded:
        return { ...errors, loadError: undefined };

    case CheckoutActionType.LoadCheckoutFailed:
        return { ...errors, loadError: action.payload };

    default:
        return errors;
    }
}

function statusesReducer(
    statuses: QuoteStatusesState = DEFAULT_STATE.statuses,
    action: BillingAddressAction | CheckoutAction
): QuoteStatusesState {
    switch (action.type) {
    case CheckoutActionType.LoadCheckoutRequested:
        return { ...statuses, isLoading: true };

    case CheckoutActionType.LoadCheckoutSucceeded:
    case CheckoutActionType.LoadCheckoutFailed:
        return { ...statuses, isLoading: false };

    default:
        return statuses;
    }
}
