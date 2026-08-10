
export interface IPayementData {
    amount : number;
}

export interface IVerifyPayment {
     razorpay_order_id: string, 
     razorpay_payment_id: string, 
     razorpay_signature : string
}