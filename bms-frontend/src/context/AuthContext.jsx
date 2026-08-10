import { useContext, createContext } from "react";
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { sendOTP, verifyOTP, activate, logout } from "../apis";
import { toast } from "react-hot-toast";

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {

    const [step, setStep] = useState(1);
    const [showModal , setShowModal] = useState(false);
    const [user, setUser] = useState(null);
    const [interval, setInterval] = useState(null);
    const [authData, setAuthData] = useState();
    const [auth, setAuth] = useState(false);

    // Mutations
    const sendOtpRequestMutation = useMutation({
        mutationFn : (email) => sendOTP({email}),
    })

    const verifyOtpRequestMutation = useMutation({
        mutationFn : (reqData) => verifyOTP(reqData),
    })

    const activateUserMutation = useMutation({
        mutationFn : (reqData) => activate(reqData),
    })

    const logOutMutation = useMutation({
        mutationFn : () => logout(),
    })


    const toggleModal = () => {
        setShowModal(!showModal)
        if(step !== 1){
            setStep(1);
        }
    }

    const sendOtpRequest = async ({email, onNext, setLoading}) => {
        sendOtpRequestMutation.mutate(email, {
            onSuccess : (res) => {
                console.log(res.data);
                setAuthData(res.data);
                toast.success("OTP sent to your email");
                onNext();
            },
            onError : (err) => {
                console.log(err);
                toast.error(err?.response?.error?.message || "Something went wrong");
            }
        })
        
    }

    const verifyOtpRequest = async (otp, onNext) => {
        const { hash, email } = authData;
        const reqData = {otp, hash, email};

        verifyOtpRequestMutation.mutate(reqData, {
            onSuccess : (res) => {
                setAuthData(null);
                setUser(res.data.user);
                setAuth(true);
                if(!res.data.user?.activateUser){
                    onNext();
                }else{
                    setStep(1);
                    toggleModal();
                }
            },
            onError : (err) => {
                console.log(err);
                toast.error(err?.response?.error?.message || "Something went wrong");
            }
        })
    }

    const activateUserRequest = async (data) => {
        const { name, phone } = data;
        const id = user?._id;
        const reqData = { id, name, phone };

        activateUserMutation.mutate(reqData, {
            onSuccess : (res) => {
                console.log(res);
                setUser(res.data);
                setStep(1);
                toggleModal();
            },
            onError : (err) => {
                console.log(err);
                toast.error(err?.response?.error?.message || "Something went wrong");
            }
        })
    };

    const logoutRequest = () => {
        logOutMutation.mutate(null, {
            onSuccess: (data) => {
            console.log(data);
            setAuth(false);
            setUser(null);
            window.location.href = "/" 
        },
            onError: (error) => {
            console.log(error);
            toast.error(error?.response?.error?.message || "Something went wrong");
        },
        })
    }

    return (
        <AuthContext.Provider value={{ step, setStep, showModal, toggleModal, sendOtpRequest, authData, user, setUser ,verifyOtpRequest, activateUserRequest, logoutRequest, auth, setAuth, otpLoader:sendOtpRequestMutation.isPending, verifyOtpLoader: verifyOtpRequestMutation.isPending, activateUserLoader: activateUserMutation.isPending }}>
            {children}
        </AuthContext.Provider>
    )

}

export const useAuth = () => useContext(AuthContext);