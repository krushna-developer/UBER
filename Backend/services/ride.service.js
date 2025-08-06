const rideModel = require('../models/ride.model');
const mapService = require('./maps.service');
const captainModel = require('../models/captain.model');
const { sendMessageToSocketId } = require('../socket'); // Make sure this exists
const crypto = require('crypto'); // bcrypt not used — removed

// 🔢 Generate OTP
function getOtp(num) {
    const otp = crypto.randomInt(Math.pow(10, num - 1), Math.pow(10, num)).toString();
    return otp;
}

// 💰 Calculate fare
async function getFare(pickup, destination) {
    if (!pickup || !destination) {
        throw new Error('Pickup and destination are required');
    }

    const { distance, duration } = await mapService.getDistanceTime(pickup, destination);

    const baseFare = { auto: 30, car: 50, moto: 20 };
    const perKmRate = { auto: 10, car: 15, moto: 8 };
    const perMinuteRate = { auto: 2, car: 3, moto: 1.5 };

    return {
        auto: Math.round(baseFare.auto + ((distance.value / 1000) * perKmRate.auto) + ((duration.value / 60) * perMinuteRate.auto)),
        car: Math.round(baseFare.car + ((distance.value / 1000) * perKmRate.car) + ((duration.value / 60) * perMinuteRate.car)),
        moto: Math.round(baseFare.moto + ((distance.value / 1000) * perKmRate.moto) + ((duration.value / 60) * perMinuteRate.moto))
    };
}

module.exports.getFare = getFare;

// 🚘 Create a ride
module.exports.createRide = async ({ user, pickup, destination, vehicleType }) => {
    if (!user || !pickup || !destination || !vehicleType) {
        throw new Error('All fields are required');
    }

    const fare = await getFare(pickup, destination);

    const createdRide = await rideModel.create({
        user,
        pickup,
        destination,
        otp: getOtp(6),
        fare: fare[vehicleType],
        status: 'pending'
    });

    // ✅ Populate user before sending to captains
    const ride = await rideModel.findById(createdRide._id).populate('user');

    // 🔔 Broadcast to all online captains
    const captains = await captainModel.find({ socketId: { $ne: null } });
    for (const captain of captains) {
        if (captain.socketId) {
            sendMessageToSocketId(captain.socketId, {
                event: 'newRide',
                data: ride
            });
        }
    }

    return ride;
};

// ✅ Confirm ride
module.exports.confirmRide = async ({ rideId, captain }) => {
    if (!rideId) {
        throw new Error('Ride id is required');
    }

    await rideModel.findByIdAndUpdate(rideId, {
        status: 'accepted',
        captain: captain._id
    });

    const ride = await rideModel.findById(rideId)
        .populate('user')
        .populate('captain')
        .select('+otp');

    if (!ride) {
        throw new Error('Ride not found');
    }

    return ride;
};

// ▶️ Start ride
module.exports.startRide = async ({ rideId, otp, captain }) => {
    if (!rideId || !otp) {
        throw new Error('Ride id and OTP are required');
    }

    const ride = await rideModel.findById(rideId)
        .populate('user')
        .populate('captain')
        .select('+otp');

    if (!ride) {
        throw new Error('Ride not found');
    }

    if (ride.status !== 'accepted') {
        throw new Error('Ride not accepted');
    }

    if (ride.otp !== otp) {
        throw new Error('Invalid OTP');
    }

    await rideModel.findByIdAndUpdate(rideId, { status: 'ongoing' });

    return ride;
};

// ⛔ End ride
module.exports.endRide = async ({ rideId, captain }) => {
    if (!rideId) {
        throw new Error('Ride id is required');
    }

    const ride = await rideModel.findOne({ _id: rideId, captain: captain._id })
        .populate('user')
        .populate('captain')
        .select('+otp');

    if (!ride) {
        throw new Error('Ride not found');
    }

    if (ride.status !== 'ongoing') {
        throw new Error('Ride not ongoing');
    }

    await rideModel.findByIdAndUpdate(rideId, { status: 'completed' });

    return ride;
};
