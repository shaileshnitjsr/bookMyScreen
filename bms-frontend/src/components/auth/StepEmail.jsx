import React, { useState} from 'react'
import { useAuth } from '../../context/AuthContext';
import { BeatLoader } from 'react-spinners';

const StepEmail = ({onNext}) => {

    const [email, setEmail] = useState();
    const { sendOtpRequest, otpLoader } = useAuth();

    const handleSendOtp = (e) => {
        e.preventDefault();
        if(!email) return;
        
        sendOtpRequest({email, onNext});
    }

  return (
    <div className='flex flex-col gap-3 px-10 py-6'>
        <h2 className='text-center text-lg font-semibold'>Enter your email</h2>
        <p className='text-center text-sm text-gray-500'>If you don't have an account, we'll create one for you.</p>
    
        <div className='flex items-center border rounded-md border-gray-300 px-4 py-3'>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                placeholder='Enter your email'
                className='flex-grow outline-none text-base'
                required
            />
        </div>

        <button type='submit' onClick={handleSendOtp} className='w-full cursor-pointer text-white bg-black py-2 rounded-md text-lg hover:bg-gray-800 transition'>
            {otpLoader ? <BeatLoader size={12} color="white" /> : "Continue"}
        </button>

        <p className='text-[#c4c5c5] text-center m-auto text-[12px]'>By entering your email id, you're agreeing to our <a href="" className='text-[#f74565]'>Terms of Service</a> and 
        <a href="" className='text-[#f74565]'>Privacy Policy</a>. Thanks!</p>
    
    </div>
  )
}

export default StepEmail;