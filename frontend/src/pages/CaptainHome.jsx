import React, { useRef, useState, useEffect, useContext } from "react";
import { Link } from "react-router-dom";
import CaptainDetails from "../components/CaptainDetails";
import RidePopUp from "../components/RidePopUp";
import ConfirmRidePopUp from "../components/ConfirmRidePopUp";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { SocketContext } from "../context/SocketContext";
import { CaptainDataContext } from "../context/CapatainContext";
import axios from "axios";

const CaptainHome = () => {
  const [ridePopupPanel, setRidePopupPanel] = useState(false);
  const [confirmRidePopupPanel, setConfirmRidePopupPanel] = useState(false);

  const ridePopupPanelRef = useRef(null);
  const confirmRidePopupPanelRef = useRef(null);
  const [ride, setRide] = useState(null);

  const { socket } = useContext(SocketContext);
  const { captain } = useContext(CaptainDataContext);

  /* ------------------------------------------------------------------ */
  /*                    1.   JOIN + GEOLOCATION                         */
  /* ------------------------------------------------------------------ */
  useEffect(() => {
    socket.emit("join", {
      userId: captain._id,
      userType: "captain",
    });

    const updateLocation = () => {
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition((position) => {
          socket.emit("update-location-captain", {
            userId: captain._id,
            location: {
              lat: position.coords.latitude,
              lng: position.coords.longitude,
            },
          });
        });
      }
    };

    updateLocation();
    const locationInterval = setInterval(updateLocation, 10000);
    return () => clearInterval(locationInterval);
  }, [socket, captain]);

  /* ------------------------------------------------------------------ */
  /*                    2.   LISTEN FOR NEW RIDE                        */
  /* ------------------------------------------------------------------ */
  useEffect(() => {
    const handleNewRide = (data) => {
      console.log("🚗 newRide received", data);
      setRide(data);
      setRidePopupPanel(true);
    };

    socket.on("newRide", handleNewRide); // <— make sure the event name matches backend

    return () => socket.off("newRide", handleNewRide);
  }, [socket]);

  /* ------------------------------------------------------------------ */
  /*                    3.   CONFIRM RIDE API                           */
  /* ------------------------------------------------------------------ */
  async function confirmRide() {
    await axios.post(
      `${import.meta.env.VITE_BASE_URL}/rides/confirm`,
      { rideId: ride._id }, // captain comes from JWT on backend
      { headers: { Authorization: `Bearer ${localStorage.getItem("token")}` } }
    );

    setRidePopupPanel(false);
    setConfirmRidePopupPanel(true);
  }

  /* ------------------------------------------------------------------ */
  /*                4.   GSAP SLIDE-IN / OUT PANELS                     */
  /* ------------------------------------------------------------------ */
  useGSAP(
    () =>
      gsap.to(ridePopupPanelRef.current, {
        transform: ridePopupPanel ? "translateY(0)" : "translateY(100%)",
      }),
    [ridePopupPanel]
  );

  useGSAP(
    () =>
      gsap.to(confirmRidePopupPanelRef.current, {
        transform: confirmRidePopupPanel ? "translateY(0)" : "translateY(100%)",
      }),
    [confirmRidePopupPanel]
  );

  /* ------------------------------------------------------------------ */
  /*                              RENDER                                */
  /* ------------------------------------------------------------------ */
  return (
    <div className="h-screen">
      {/* Debug: remove in production */}
      {console.log("New Ride Data:", ride)}

      <div className="fixed p-6 top-0 flex items-center justify-between w-screen">
        <img
          className="w-16"
          src="https://upload.wikimedia.org/wikipedia/commons/c/cc/Uber_logo_2018.png"
          alt="App Logo"
        />
        <Link
          to="/captain-home"
          className="h-10 w-10 bg-white flex items-center justify-center rounded-full"
        >
          <i className="text-lg font-medium ri-logout-box-r-line"></i>
        </Link>
      </div>

      <div className="h-3/5">
        <img
          className="h-full w-full object-cover"
          src="https://miro.medium.com/v2/resize:fit:1400/0*gwMx05pqII5hbfmX.gif"
          alt="Map"
        />
      </div>

      <div className="h-2/5 p-6">
        <CaptainDetails />
      </div>

      {/* Ride request pop-up */}
      <div
        ref={ridePopupPanelRef}
        className="fixed w-full z-10 bottom-0 translate-y-full bg-white px-3 py-10 pt-12"
      >
        <RidePopUp
          ride={ride}
          setRidePopupPanel={setRidePopupPanel}
          setConfirmRidePopupPanel={setConfirmRidePopupPanel}
          confirmRide={confirmRide}
        />
      </div>

      {/* Confirmed ride pop-up */}
      <div
        ref={confirmRidePopupPanelRef}
        className="fixed w-full h-screen z-10 bottom-0 translate-y-full bg-white px-3 py-10 pt-12"
      >
        <ConfirmRidePopUp
          ride={ride}
          setConfirmRidePopupPanel={setConfirmRidePopupPanel}
          setRidePopupPanel={setRidePopupPanel}
        />
      </div>
    </div>
  );
};

export default CaptainHome;
