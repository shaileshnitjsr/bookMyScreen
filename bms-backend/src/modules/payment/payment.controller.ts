
import { Request, Response, NextFunction } from "express";
import * as PaymentService from "./payement.service";


export const createOrder = async (req: Request, res: Response, next: NextFunction) => {
    try {
        
        const order = await PaymentService.createOrder(req.body);
        res.status(201).json(order);

    } catch (error) {
        next(error);
    }
}

export const verifyPayment = async (req: Request, res: Response, next: NextFunction) => {
    try {
        
        const isVerified = await PaymentService.verifyPayement(req.body);
        if(!isVerified){
            res.status(400).json({
                success: false,
                message: "Payment verification failed!"
            })
        }

        res.status(200).json({success: true,
                message: "Payment verification successfully!"})

    } catch (error) {
        next(error);
    }
}