import express from 'express';
import { generateRegistrationOptions, verifyRegistrationResponse, generateAuthenticationOptions, verifyAuthenticationResponse } from '@simplewebauthn/server';
import jwt from 'jsonwebtoken';

const router = express.Router();

// In-memory mock DB for users and their credentials.
// In a real application, these would be in a persistent database.
const users: Record<string, any> = {};
const userChallenges: Record<string, string> = {}; // username -> expectedChallenge

const JWT_SECRET = process.env.JWT_SECRET || 'super-secure-secret-key-12345';
const RP_ID = process.env.RP_ID || 'localhost';
const EXPECTED_ORIGIN = process.env.EXPECTED_ORIGIN || 'http://localhost:5173';

// Registration
router.post('/register/generate-options', async (req, res) => {
    const { username } = req.body;
    if (!username) {
        return res.status(400).json({ error: 'Username is required' });
    }

    if (!users[username]) {
        users[username] = { id: username, username, credentials: [] };
    }
    const user = users[username];

    try {
        const options = await generateRegistrationOptions({
            rpName: 'FreightWise B2B Logistics',
            rpID: RP_ID,
            userID: new Uint8Array(Buffer.from(user.id)),
            userName: user.username,
            timeout: 60000,
            attestationType: 'none',
            authenticatorSelection: {
                residentKey: 'required',
                userVerification: 'required',
            },
        });

        userChallenges[username] = options.challenge;
        res.json(options);
    } catch (err) {
        res.status(500).json({ error: 'Failed to generate registration options' });
    }
});

router.post('/register/verify', async (req, res) => {
    const { username, response } = req.body;
    const expectedChallenge = userChallenges[username];

    if (!expectedChallenge) {
        return res.status(400).json({ error: 'Challenge not found' });
    }

    try {
        const verification = await verifyRegistrationResponse({
            response,
            expectedChallenge,
            expectedOrigin: EXPECTED_ORIGIN,
            expectedRPID: RP_ID,
            requireUserVerification: true,
        });

        if (verification.verified && verification.registrationInfo) {
            users[username].credentials.push(verification.registrationInfo.credential);
            delete userChallenges[username];
            return res.json({ verified: true });
        }
        res.status(400).json({ verified: false });
    } catch (err: any) {
        res.status(400).json({ error: err.message });
    }
});

// Authentication
router.post('/login/generate-options', async (req, res) => {
    const { username } = req.body;
    const user = users[username];

    if (!user) {
        return res.status(404).json({ error: 'User not found' });
    }

    try {
        const options = await generateAuthenticationOptions({
            rpID: RP_ID,
            allowCredentials: user.credentials.map((cred: any) => ({
                id: cred.id,
                type: 'public-key',
            })),
            userVerification: 'required',
        });

        userChallenges[username] = options.challenge;
        res.json(options);
    } catch (err) {
        res.status(500).json({ error: 'Failed to generate auth options' });
    }
});

router.post('/login/verify', async (req, res) => {
    const { username, response } = req.body;
    const user = users[username];
    const expectedChallenge = userChallenges[username];

    if (!user || !expectedChallenge) {
        return res.status(400).json({ error: 'Invalid state' });
    }

    const authenticator = user.credentials.find((c: any) => c.id === response.id);

    if (!authenticator) {
        return res.status(400).json({ error: 'Authenticator not found' });
    }

    try {
        const verification = await verifyAuthenticationResponse({
            response,
            expectedChallenge,
            expectedOrigin: EXPECTED_ORIGIN,
            expectedRPID: RP_ID,
            credential: {
                id: authenticator.id,
                publicKey: authenticator.publicKey,
                counter: authenticator.counter,
            },
            requireUserVerification: true,
        });

        if (verification.verified) {
            delete userChallenges[username];
            // Issue short-lived JWT securely via cookie as per directive
            const token = jwt.sign({ username }, JWT_SECRET, { expiresIn: '15m' });
            res.cookie('token', token, { httpOnly: true, secure: true, sameSite: 'strict' });
            return res.json({ verified: true });
        }
        res.status(400).json({ verified: false });
    } catch (err: any) {
        res.status(400).json({ error: err.message });
    }
});

export default router;