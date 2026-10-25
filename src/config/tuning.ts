export const TUNING = {
  player: { walkSpeed: 3.2, sprintSpeed: 6.0, staminaMax: 100, staminaDrainSprint: 12, jumpForce: 6.0 },
  buckets: {
    distanceMeters: 60, // shortened for playability
    spillAngleDeg: 18,
    spillRatePerSec: 0.08,
    swayFromTurn: 0.6,
    swayFromAccel: 0.4,
    passThreshold: 0.7,
    horseStanceSeconds: [20, 30, 45],
  },
  yak: { pullBurstEverySec: [2.5, 4.5], sweetZone: [0.35, 0.7], distanceMeters: 40 },
  ger: { roofPoles: 16, carryLimit: 4, medalTimeSec: 600 },
  cards: { startScore: 15, zeroTrickPenalty: 5, maxExchange: 3 },
  tag: { round1Sec: 90, round2Sec: 60 },
  english: { repsToMaster: 3, wordsPerSet: 3, rewardPerSetUSD: 1, graduationUSD: 5 },
  startingCashUSD: 50,
  startingNotifications: 2847,
};
