import React, { use } from "react";

const useCurrentStateLocation = () => {
  const [location, setLocation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        console.log(longitude, latitude);
      },
      (err) => {
        setError("Permission denied or unable to fetch location.");
        setLoading(false);
      }
    );
  }, []);

  return { location, loading, error };
};

export default useCurrentStateLocation;
