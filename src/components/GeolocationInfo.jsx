// src/components/GeolocationInfo.jsx
import React, { useState, useEffect, useCallback } from 'react';

const GeolocationInfo = ({ googleMapsApiKey, lang = 'fr' }) => { // Plus besoin de vtcAddress en prop
    const [userLocation, setUserLocation] = useState(null);
    const [driverLocation, setDriverLocation] = useState(null);
    const [distanceTime, setDistanceTime] = useState(null);
    const [error, setError] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const [hasUserConsent, setHasUserConsent] = useState(false); // Pour le consentement utilisateur

    const translations = {
        fr: {
            title: "Votre temps de trajet avec ShipCars",
            gettingUserLocation: "Chargement de votre position...",
            gettingDriverLocation: "Récupération de la position du chauffeur...",
            calculatingRoute: "Calcul du temps de trajet...",
            permissionDenied: "Géolocalisation refusée. Veuillez l'activer pour utiliser cette fonction.",
            unavailable: "Géolocalisation non disponible sur votre appareil.",
            timeout: "La requête de géolocalisation a expiré.",
            unknownError: "Une erreur inattendue est survenue lors de la géolocalisation.",
            noDriverLocation: "Le chauffeur VTC n'a pas encore partagé sa position.",
            distanceMessage: "Votre VTC est à environ {time} de votre position actuelle en voiture.",
            errorCalculating: "Erreur lors du calcul du temps de trajet. Veuillez réessayer plus tard.",
            buttonText: "Actualiser le temps de trajet",
            buttonTextConsent: "Partager ma position pour calculer le temps de trajet",
            shareLocationPrompt: "Veuillez accepter le partage de votre position pour calculer le temps de trajet."
        },
        en: {
            title: "Your travel time with ShipCars",
            gettingUserLocation: "Getting your location...",
            gettingDriverLocation: "Fetching driver's location...",
            calculatingRoute: "Calculating travel time...",
            permissionDenied: "Geolocation permission denied. Please enable it to use this feature.",
            unavailable: "Geolocation is not available on your device.",
            timeout: "Geolocation request timed out.",
            unknownError: "An unexpected error occurred during geolocation.",
            noDriverLocation: "The VTC driver has not yet shared their location.",
            distanceMessage: "Your VTC is approximately {time} away from your current location by car.",
            errorCalculating: "Error calculating travel time. Please try again later.",
            buttonText: "Refresh travel time",
            buttonTextConsent: "Share my location to calculate travel time",
            shareLocationPrompt: "Please allow location sharing to calculate travel time."
        },
        es: {
            title: "Tu tiempo de viaje con ShipCars",
            gettingUserLocation: "Cargando tu ubicación...",
            gettingDriverLocation: "Obteniendo la ubicación del conductor...",
            calculatingRoute: "Calculando tiempo de viaje...",
            permissionDenied: "Permiso de geolocalización denegado. Por favor, actívalo para usar esta función.",
            unavailable: "La geolocalización no está disponible en tu dispositivo.",
            timeout: "La solicitud de geolocalización ha expirado.",
            unknownError: "Ocurrió un error inesperado durante la geolocalización.",
            noDriverLocation: "El conductor VTC aún no ha compartido su ubicación.",
            distanceMessage: "Tu VTC está a aproximadamente {time} de tu ubicación actual en coche.",
            errorCalculating: "Error al calcular el tiempo de viaje. Por favor, inténtalo de nuevo más tarde.",
            buttonText: "Actualizar tiempo de viaje",
            buttonTextConsent: "Compartir mi ubicación para calcular el tiempo de viaje",
            shareLocationPrompt: "Por favor, permite compartir tu ubicación para calcular el tiempo de viaje."
        }
    };

    const t = translations[lang] || translations.fr;

    // Fonction pour charger le script Google Maps si pas déjà chargé
    const loadGoogleMapsScript = useCallback(() => {
        if (!window.google || !window.google.maps || !window.google.maps.DirectionsService) {
            const script = document.createElement('script');
            script.src = `https://maps.googleapis.com/maps/api/js?key=${googleMapsApiKey}&libraries=geometry,places&callback=initMapForGeolocation`;
            script.async = true;
            script.defer = true;
            document.head.appendChild(script);

            return new Promise((resolve, reject) => {
                window.initMapForGeolocation = () => resolve();
                script.onerror = () => reject(new Error("Google Maps script failed to load."));
            });
        }
        return Promise.resolve();
    }, [googleMapsApiKey]);

    // Fonction pour récupérer la position du chauffeur
    const fetchDriverLocation = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const response = await fetch('/api/update-driver-location'); // GET request to our API endpoint
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
            }
            const data = await response.json();
            if (data && data.lat !== null && data.lng !== null) {
                setDriverLocation({ lat: data.lat, lng: data.lng });
            } else {
                setDriverLocation(null);
                setError(t.noDriverLocation);
            }
        } catch (err) {
            setError(t.errorCalculating + ": " + t.gettingDriverLocation);
            console.error("Error fetching driver location:", err);
            setDriverLocation(null);
        } finally {
            setIsLoading(false);
        }
    }, [t]);

    const calculateRoute = useCallback(async (origin, destination) => {
        if (!window.google || !window.google.maps || !window.google.maps.DirectionsService) {
            setError(t.errorCalculating + ": Google Maps API not loaded.");
            setIsLoading(false);
            return;
        }

        try {
            const directionsService = new window.google.maps.DirectionsService();
            directionsService.route(
                {
                    origin: new window.google.maps.LatLng(origin.lat, origin.lng),
                    destination: new window.google.maps.LatLng(destination.lat, destination.lng),
                    travelMode: window.google.maps.TravelMode.DRIVING,
                },
                (response, status) => {
                    if (status === 'OK' && response.routes && response.routes.length > 0) {
                        const route = response.routes[0].legs[0];
                        setDistanceTime(route.duration.text);
                        setError(null);
                    } else {
                        setError(t.errorCalculating);
                        console.error('Directions request failed due to ' + status);
                    }
                    setIsLoading(false);
                }
            );
        } catch (err) {
            setError(t.errorCalculating + ": " + err.message);
            console.error("Error during route calculation:", err);
            setIsLoading(false);
        }
    }, [t]);


    const getUserLocationAndCalculateRoute = useCallback(async () => {
        if (!navigator.geolocation) {
            setError(t.unavailable);
            return;
        }

        setIsLoading(true);
        setError(null);
        setDistanceTime(null);
        setHasUserConsent(false); // Réinitialise le consentement à chaque tentative

        updateStatus(t.gettingUserLocation); // Affiche le message de chargement

        navigator.geolocation.getCurrentPosition(
            async (position) => {
                const userLat = position.coords.latitude;
                const userLng = position.coords.longitude;
                setUserLocation({ lat: userLat, lng: userLng });
                setHasUserConsent(true);

                updateStatus(t.gettingDriverLocation); // Puis celui du chauffeur
                await fetchDriverLocation(); // Récupère la position du chauffeur

            },
            (posError) => {
                setIsLoading(false);
                switch (posError.code) {
                    case posError.PERMISSION_DENIED:
                        setError(t.permissionDenied);
                        break;
                    case posError.POSITION_UNAVAILABLE:
                        setError(t.unavailable);
                        break;
                    case posError.TIMEOUT:
                        setError(t.timeout);
                        break;
                    default:
                        setError(t.unknownError);
                        break;
                }
                console.error("Geolocation error:", posError);
            },
            {
                enableHighAccuracy: true,
                timeout: 5000,
                maximumAge: 0,
            }
        );
    }, [t, fetchDriverLocation]);


    // Effectuer le calcul de la route lorsque userLocation OU driverLocation changent
    useEffect(() => {
        if (userLocation && driverLocation) {
            setIsLoading(true);
            setError(null);
            loadGoogleMapsScript().then(() => {
                calculateRoute(userLocation, driverLocation);
            }).catch(scriptError => {
                setError(t.errorCalculating + ": Google Maps script failed to load. " + scriptError.message);
                setIsLoading(false);
            });
        } else if (userLocation && !driverLocation && hasUserConsent) {
            // Si l'utilisateur a donné son consentement, mais que la position du chauffeur manque,
            // cela a déjà été géré par fetchDriverLocation, donc pas besoin de ré-afficher une erreur ici
            // à moins qu'on veuille un message spécifique.
        } else if (!userLocation && !driverLocation && hasUserConsent) {
            // Si l'utilisateur a donné son consentement mais que les deux manquent
            // On peut aussi déclencher une erreur ici ou un message d'attente
        }
    }, [userLocation, driverLocation, loadGoogleMapsScript, calculateRoute, t, hasUserConsent]);

    // État de chargement pour les messages
    const [statusText, setStatusText] = useState("");
    const updateStatus = (message) => {
        setStatusText(message);
    };


    return (
        <div style={{
            padding: '2rem',
            maxWidth: '600px',
            margin: '2rem auto',
            backgroundColor: '#2b2b2b',
            borderRadius: '8px',
            boxShadow: '0 4px 15px rgba(0, 0, 0, 0.3)',
            color: '#f0f0f0',
            textAlign: 'center'
        }}>
            <h2 style={{ color: '#35c2b5' }}>{t.title}</h2>
            
            { (!userLocation && !hasUserConsent && !isLoading && !error) && (
                <p style={{ color: '#d0d0d0' }}>{t.shareLocationPrompt}</p>
            )}

            <button
                onClick={getUserLocationAndCalculateRoute}
                disabled={isLoading}
                style={{
                    backgroundColor: '#35c2b5',
                    color: '#ffffff',
                    border: 'none',
                    padding: '0.8rem 1.5rem',
                    borderRadius: '5px',
                    cursor: 'pointer',
                    fontSize: '1rem',
                    fontWeight: 'bold',
                    marginTop: '1rem',
                    transition: 'background-color 0.3s ease',
                }}
            >
                {isLoading ? statusText : (userLocation ? t.buttonText : t.buttonTextConsent)}
            </button>

            {isLoading && <p style={{ marginTop: '1rem', color: '#35c2b5' }}>{statusText}</p>}

            {distanceTime && (
                <p style={{ fontSize: '1.2rem', fontWeight: 'bold', marginTop: '1.5rem', color: '#fff' }}>
                    {t.distanceMessage.replace('{time}', distanceTime)}
                </p>
            )}

            {error && <p style={{ color: '#ff6b6b', marginTop: '1rem' }}>{error}</p>}

            {/* Affiche les positions pour le débogage si besoin */}
            {/* {userLocation && <p>User: {userLocation.lat}, {userLocation.lng}</p>}
            {driverLocation && <p>Driver: {driverLocation.lat}, {driverLocation.lng}</p>} */}
        </div>
    );
};

export default GeolocationInfo;