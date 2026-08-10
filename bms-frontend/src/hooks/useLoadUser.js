import { useEffect, useState } from "react";
import { getUser } from "../apis";
import { useAuth } from "../context/AuthContext";


export const useLoadUser = () => {
    const [ isLoading, setIsLoading ] = useState(true);
    const { setUser, setAuth } = useAuth();

    useEffect(() => {
        (async () => {
            try {
                const { data } = await getUser();
                setUser(data);
                setAuth(true);
            } catch (error) {
                console.log(error);
            }finally {
                setIsLoading(false);
            }
        })();
    }, []);


    return { isLoading };
}