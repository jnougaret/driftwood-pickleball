// Driftwood Pickleball Authentication
// Handles user authentication via Clerk (Google, Apple, Facebook OAuth)

let clerkInstance = null;
let currentUser = null;

let clerkReadyResolve;
let clerkReadyReject;
const clerkReadyPromise = new Promise((resolve, reject) => {
    clerkReadyResolve = resolve;
    clerkReadyReject = reject;
});

const CLERK_LOAD_TIMEOUT_MS = 10000;

function waitForClerk() {
    return new Promise((resolve, reject) => {
        if (window.Clerk) {
            resolve(window.Clerk);
            return;
        }

        let elapsed = 0;
        const interval = 100;
        const timer = setInterval(() => {
            elapsed += interval;
            if (window.Clerk) {
                clearInterval(timer);
                resolve(window.Clerk);
                return;
            }
            if (elapsed >= CLERK_LOAD_TIMEOUT_MS) {
                clearInterval(timer);
                reject(new Error('Clerk failed to load'));
            }
        }, interval);
    });
}

// Initialize Clerk when the page loads
window.addEventListener('load', async () => {
    try {
        const Clerk = await waitForClerk();
        await Clerk.load();
        clerkInstance = Clerk;

        // Check if user is signed in
        if (clerkInstance.user) {
            currentUser = clerkInstance.user;
            await handleAuthenticatedUser();
        } else {
            handleUnauthenticatedUser();
        }

        // Listen for auth changes
        clerkInstance.addListener(({ user }) => {
            if (user) {
                currentUser = user;
                handleAuthenticatedUser();
            } else {
                currentUser = null;
                handleUnauthenticatedUser();
            }
            window.dispatchEvent(new CustomEvent('auth:changed', { detail: { user: currentUser } }));
        });

        clerkReadyResolve(clerkInstance);
    } catch (error) {
        console.error('Error initializing Clerk:', error);
        handleUnauthenticatedUser();
        clerkReadyReject(error);
    }
});

// Handle authenticated user state
async function loadAuthProfile() {
    try {
        const token = await clerkInstance.session.getToken();
        const response = await fetch('/api/auth/profile', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (response.ok) {
            const profile = await response.json();
            window.authProfile = profile;
        }
        return response;
    } catch (error) {
        console.error('Error loading user profile:', error);
        return null;
    }
}

async function handleAuthenticatedUser() {
    console.log('User signed in:', currentUser);

    // Update UI to show authenticated state
    updateAuthButtons(true);

    const pendingReturnUrl = sessionStorage.getItem('signInReturnUrl');
    if (pendingReturnUrl) {
        sessionStorage.removeItem('signInReturnUrl');
        if (pendingReturnUrl !== window.location.href && !window.location.pathname.startsWith('/profile')) {
            window.location.href = pendingReturnUrl;
            return;
        }
    }

    const shouldRedirectAfterSignIn = sessionStorage.getItem('redirectToProfileOnSignIn') === '1';
    sessionStorage.removeItem('redirectToProfileOnSignIn');

    const response = await loadAuthProfile();
    if (!response) {
        return;
    }

    if (response.status === 404) {
        // User doesn't have a profile yet - redirect to profile creation
        console.log('New user - redirecting to profile creation');
        if (shouldRedirectAfterSignIn) {
            redirectToProfileForLink();
        }
    } else if (response.ok && window.authProfile) {
        if (!window.authProfile.duprId) {
            if (shouldRedirectAfterSignIn) {
                redirectToProfileForLink();
            }
        }
    }
}

function redirectToProfileForLink() {
    const path = window.location.pathname;
    if (path.endsWith('profile.html') || path.startsWith('/profile')) {
        return;
    }
    if (window.location.search.includes('return=')) {
        return;
    }
    const returnUrl = encodeURIComponent(window.location.href);
    window.location.href = `profile.html?source=signin&return=${returnUrl}`;
}

// Handle unauthenticated user state
function handleUnauthenticatedUser() {
    console.log('User not signed in');
    updateAuthButtons(false);
}

// Update authentication buttons in navigation
function updateAuthButtons(isAuthenticated) {
    const desktopContainer = document.getElementById('auth-buttons-desktop');
    const mobileContainer = document.getElementById('auth-buttons-mobile');

    if (!desktopContainer || !mobileContainer) return;

    if (isAuthenticated) {
        // Show profile link (sign out is on profile page)
        const userName = currentUser.firstName || currentUser.emailAddresses[0].emailAddress.split('@')[0];

        desktopContainer.innerHTML = `
            <a href="profile.html" class="text-gray-700 hover:text-ocean-blue transition font-medium">
                ${userName}
            </a>
        `;

        mobileContainer.innerHTML = `
            <a href="profile.html" class="block px-3 py-2 text-gray-700 hover:bg-gray-100 font-medium">
                ${userName}
            </a>
        `;
    } else {
        // Show sign in button
        desktopContainer.innerHTML = `
            <button onclick="signIn()" class="bg-ocean-blue text-white px-4 py-2 rounded-lg hover:bg-ocean-teal transition font-semibold">
                Sign In
            </button>
        `;

        mobileContainer.innerHTML = `
            <button onclick="signIn()" class="block w-full text-left px-3 py-2 bg-ocean-blue text-white hover:bg-ocean-teal rounded">
                Sign In
            </button>
        `;
    }
}

// Sign in function - opens Clerk sign-in modal
async function signIn() {
    try {
        sessionStorage.setItem('redirectToProfileOnSignIn', '1');
        sessionStorage.setItem('signInReturnUrl', window.location.href);
        await clerkInstance.openSignIn({
            redirectUrl: window.location.href
        });
    } catch (error) {
        console.error('Error opening sign in:', error);
    }
}

// Sign out function
async function signOut() {
    try {
        await clerkInstance.signOut();
        window.location.reload();
    } catch (error) {
        console.error('Error signing out:', error);
    }
}

// Get current user's authentication token (for API calls)
async function getAuthToken() {
    if (!clerkInstance || !clerkInstance.session) {
        return null;
    }
    return await clerkInstance.session.getToken();
}

function getClerkInstance() {
    return clerkInstance;
}

// Check if user is authenticated
function isAuthenticated() {
    return currentUser !== null;
}

// Get current user info
function getCurrentUser() {
    return currentUser;
}

// Export functions for use in other scripts
window.authUtils = {
    ready: () => clerkReadyPromise,
    getClerkInstance,
    getAuthToken,
    isAuthenticated,
    getCurrentUser,
    loadAuthProfile,
    signIn,
    signOut
};
