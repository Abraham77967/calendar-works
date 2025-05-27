// Firebase configuration - REPLACE WITH YOUR OWN CONFIG from Firebase console
// Go to your Firebase project > Project Settings > Add Web App > Copy the config object
const firebaseConfig = {
    apiKey: "AIzaSyCOgSFssUQohtp7znEfq3mb2bmTH-00p4c",
    authDomain: "calendar-7f322.firebaseapp.com",
    projectId: "calendar-7f322",
    storageBucket: "calendar-7f322.firebasestorage.app",
    messagingSenderId: "127539488630",
    appId: "1:127539488630:web:5c60fb6e5417d12bd37c57"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);

// Initialize Firestore
const db = firebase.firestore();

// Global temporary storage for task promotion data
let tempPromotionData = null;

// Function to completely clear all calendar data
function clearAllCalendarData() {
    console.log('[CLEAR DATA] Clearing all calendar data');
    
    // Clear localStorage
    localStorage.removeItem('calendarNotes');
    localStorage.removeItem('mainGoals');
    
    // Create a new empty object
    window.calendarNotes = {};
    
    console.log('[CLEAR DATA] Calendar data cleared');
    return window.calendarNotes;
}

document.addEventListener('DOMContentLoaded', () => {
    // Declare notes as a global variable outside of the function scope
    // This was the main issue - the 'notes' variable was being reset each time
    window.calendarNotes = window.calendarNotes || {};
    let notes = window.calendarNotes;

    // Only initialize if empty
    if (Object.keys(notes).length === 0) {
        notes = {};
        window.calendarNotes = notes;
    }
    
    // Initialize main goals array (limited to 3)
    // Ensure goals are objects: { text: string, completed: boolean }
    let mainGoals = JSON.parse(localStorage.getItem('mainGoals')) || [];
    mainGoals = mainGoals.map(goal => {
        if (typeof goal === 'string') {
            return { text: goal, completed: false }; // Convert old string goals
        }
        return goal; // Already an object, or will be filtered if invalid
    }).filter(goal => goal && typeof goal.text === 'string'); // Ensure valid structure
    
    // Check for redirect result first
    firebase.auth().getRedirectResult().then((result) => {
        if (result.user) {
            console.log('Google sign in successful via redirect:', result.user.email);
        }
    }).catch((error) => {
        console.error('Redirect sign-in error:', error);
        if (error.code !== 'auth/null-user') {
            alert(`Sign in failed: ${error.message}`);
        }
    });
    
    // Get references for calendar and shared controls
    const monthYearDisplayElement = document.getElementById('month-year-display'); // Top control header
    const calendarGrid1 = document.getElementById('calendar-grid-1');
    const monthYearElement1 = document.getElementById('month-year-1');
    const calendarGrid2 = document.getElementById('calendar-grid-2'); // Added back
    const monthYearElement2 = document.getElementById('month-year-2'); // Added back
    const calendar2Container = document.getElementById('calendar-2'); // Container for hiding

    const prevButton = document.getElementById('prev-month'); // Use generic name
    const nextButton = document.getElementById('next-month'); // Use generic name
    
    const noteModal = document.getElementById('note-modal');
    const modalDateElement = document.getElementById('modal-date');
    const closeButton = document.querySelector('.close-button');
    
    // New modal elements for multi-event support
    const eventsListElement = document.getElementById('events-list');
    
    // Add new event section elements
    const newEventTimeElement = document.getElementById('new-event-time');
    const newEventTextElement = document.getElementById('new-event-text');
    const newEventChecklistElement = document.getElementById('new-event-checklist');
    const newChecklistItemElement = document.getElementById('new-checklist-item');
    const addItemButton = document.getElementById('add-item-button');
    const addEventButton = document.getElementById('add-event-button');
    
    // Edit event section elements
    const editEventSection = document.getElementById('edit-event-section');
    const editEventTimeElement = document.getElementById('edit-event-time');
    const editEventTextElement = document.getElementById('edit-event-text');
    const editEventChecklistElement = document.getElementById('edit-event-checklist');
    const editChecklistItemElement = document.getElementById('edit-checklist-item');
    const editAddItemButton = document.getElementById('edit-add-item-button');
    const saveEditedEventButton = document.getElementById('save-edited-event');
    const cancelEditButton = document.getElementById('cancel-edit');
    const deleteEventButton = document.getElementById('delete-event');
    
    // Progress panel elements
    const eventProgressPanel = document.getElementById('event-progress-panel');
    const progressItemsContainer = document.getElementById('progress-items-container');
    
    // Authentication elements
    const loginForm = document.getElementById('login-form');
    const userInfo = document.getElementById('user-info');
    const userEmail = document.getElementById('user-email');
    const googleSignInButton = document.getElementById('google-signin-button');
    const logoutButton = document.getElementById('logout-button');
    const toggleViewButton = document.getElementById('toggle-view-button');

    // Main Goals elements
    const goalsContainer = document.getElementById('goals-container');
    const editGoalsButton = document.getElementById('edit-goals-button');
    const goalsModal = document.getElementById('goals-modal');
    const goalInputs = [
        document.getElementById('goal-1'),
        document.getElementById('goal-2'),
        document.getElementById('goal-3')
    ];
    const saveGoalsButton = document.getElementById('save-goals-button');
    const goalsCloseButton = document.querySelector('.goals-close-button');

    let currentView = 'week'; // Mobile view state: 'week' or 'month'

    // Create fresh date objects for the current date
    const currentDate = new Date();
    // Reset time portions to zero for accurate date comparison
    currentDate.setHours(0, 0, 0, 0);
    
    // Set up desktop month view (start at first day of current month)
    let desktopMonthDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
    desktopMonthDate.setHours(0, 0, 0, 0);
    console.log('[INIT] Desktop month date:', desktopMonthDate);
    
    // Set up mobile month view (start at first day of current month)
    let mobileMonthDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
    mobileMonthDate.setHours(0, 0, 0, 0);
    console.log('[INIT] Mobile month date:', mobileMonthDate);
    
    // Set up mobile week view (start at current date)
    let mobileWeekStartDate = new Date(currentDate);
    mobileWeekStartDate.setHours(0, 0, 0, 0);
    console.log('[INIT] Mobile week start date:', mobileWeekStartDate);
    
    let selectedDateString = null;
    // Create a fresh today variable with the current date
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Debug output for today's date
    console.log('[INIT] Today date:', today);
    console.log('[INIT] Today date string:', 
        `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`);

    // Add variable to track current event being edited
    let currentEditingEventId = null;

    // --- Firebase Authentication Logic ---
    
    // Google Sign-in
    googleSignInButton.addEventListener('click', () => {
        console.log('Starting Google sign in process');
        const provider = new firebase.auth.GoogleAuthProvider();
        
        // Add scopes if needed
        provider.addScope('https://www.googleapis.com/auth/contacts.readonly');
        
        // Set custom parameters
        provider.setCustomParameters({
            'login_hint': 'user@example.com',
            'prompt': 'select_account'
        });
        
        firebase.auth().signInWithPopup(provider)
            .then((result) => {
                console.log('Google sign in successful:', result.user.email);
            })
            .catch((error) => {
                console.error('Google sign in error:', error);
                
                // Try redirect method if popup fails
                if (error.code === 'auth/popup-blocked' || error.code === 'auth/popup-closed-by-user') {
                    console.log('Popup was blocked or closed, trying redirect method');
                    firebase.auth().signInWithRedirect(provider);
                } else {
                    alert(`Sign in failed: ${error.message}`);
                }
            });
    });
    
    // Logout event
    logoutButton.addEventListener('click', () => {
        firebase.auth().signOut()
            .then(() => {
                console.log('User signed out successfully');
                // Force a complete page reload to ensure clean state
                window.location.reload(true);
            })
            .catch((error) => {
                console.error('Sign out error:', error);
            });
    });
    
    // Check authentication state
    firebase.auth().onAuthStateChanged(user => {
        if (user) {
            // User is signed in
            console.log('[AUTH] User detected:', user.email);
            loginForm.style.display = 'none';
            userInfo.style.display = 'block';
            userEmail.textContent = user.email;
            
            // Fetch notes from Firestore
            console.log('[AUTH] Fetching notes for user:', user.uid);
            db.collection('userNotes').doc(user.uid).get()
                .then(doc => {
                    console.log('[AUTH] Firestore response:', doc.exists ? 'Document exists' : 'No document found');
                    if (doc.exists) {
                        // Use cloud data only when signed in
                        if (doc.data().notes) {
                            // Update the global notes object
                            window.calendarNotes = doc.data().notes;
                            // Update our local reference
                            notes = window.calendarNotes;
                            console.log('[AUTH] Loaded notes from cloud');
                        }
                        
                        // Load main goals if they exist in cloud data
                        if (doc.data().mainGoals) {
                            mainGoals = doc.data().mainGoals;
                            localStorage.setItem('mainGoals', JSON.stringify(mainGoals));
                            console.log('[AUTH] Loaded main goals from cloud');
                        }
                        
                        renderCalendarView();
                        renderMainGoals();
                    } else {
                        // No cloud data, start with empty notes
                        // Keep using our global object, but reset it if empty
                        if (Object.keys(window.calendarNotes).length === 0) {
                            window.calendarNotes = {};
                            notes = window.calendarNotes;
                        }
                        console.log('[AUTH] No existing notes found in cloud, using current data');
                        renderCalendarView();
                        renderMainGoals();
                    }
                })
                .catch(error => {
                    console.error("[AUTH] Error fetching notes:", error);
                    alert("Error fetching your calendar data: " + error.message);
                    // Keep using our global object, but reset it if empty
                    if (Object.keys(window.calendarNotes).length === 0) {
                        window.calendarNotes = {};
                        notes = window.calendarNotes;
                    }
                    renderCalendarView(); // Render view with existing data
                    renderMainGoals();
                });
        } else {
            // User is signed out - for testing purposes, allow using the app
            console.log('[AUTH] No user logged in - using test mode');
            loginForm.style.display = 'block';
            userInfo.style.display = 'none';
            
            // Keep using our global notes object 
            if (Object.keys(window.calendarNotes).length === 0) {
                window.calendarNotes = {}; // Only initialize if empty
                notes = window.calendarNotes;
                console.log('[AUTH] Using empty notes object for testing');
            } else {
                notes = window.calendarNotes;
                console.log('[AUTH] Using existing notes data for testing');
            }
            
            // Render with test data
            renderCalendarView();
            renderMainGoals();
        }
    });
    
    // --- End Firebase Authentication Logic ---

    // --- Main Goals Functions ---
    function renderMainGoals() {
        goalsContainer.innerHTML = '';
        if (mainGoals.length === 0) {
            goalsContainer.innerHTML = '<p class="no-goals-message">No main goals set yet. Click "Edit Goals" to add some!</p>';
            return;
        }
        mainGoals.forEach((goal, index) => {
            const goalItem = document.createElement('div');
            goalItem.classList.add('goal-item');
            if (goal.completed) {
                goalItem.classList.add('completed-goal');
            }

            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.checked = goal.completed;
            checkbox.id = `main-goal-cb-${index}`;
            checkbox.dataset.goalIndex = index;
            checkbox.addEventListener('change', handleMainGoalCheckboxChange);

            const goalText = document.createElement('label'); // Use label for accessibility
            goalText.htmlFor = checkbox.id;
            goalText.textContent = goal.text;
            
            goalItem.appendChild(checkbox);
            goalItem.appendChild(goalText);
            goalsContainer.appendChild(goalItem);
        });
    }

    function handleMainGoalCheckboxChange(event) {
        const goalIndex = parseInt(event.target.dataset.goalIndex);
        if (goalIndex >= 0 && goalIndex < mainGoals.length) {
            mainGoals[goalIndex].completed = event.target.checked;
            localStorage.setItem('mainGoals', JSON.stringify(mainGoals));
            renderMainGoals(); // Re-render to update styles
            console.log(`[GOALS] Main goal '${mainGoals[goalIndex].text}' completed: ${mainGoals[goalIndex].completed}`);
        }
    }

    function openGoalsModal() {
        goalInputs.forEach((input, index) => {
            if (mainGoals[index]) {
                input.value = mainGoals[index].text;
            } else {
                input.value = '';
            }
        });
        goalsModal.style.display = 'block';
    }

    function saveMainGoals() {
        const newGoals = [];
        goalInputs.forEach((input, index) => {
            const text = input.value.trim();
            if (text) {
                // Preserve completed status if goal text is the same, or default to false for new/changed text
                const existingGoal = mainGoals.find(g => g.text === text);
                newGoals.push({ 
                    text: text, 
                    completed: existingGoal ? existingGoal.completed : (mainGoals[index] && mainGoals[index].text === text ? mainGoals[index].completed : false)
                });
            }
        });
        mainGoals = newGoals.slice(0, 3); // Limit to 3 goals
        localStorage.setItem('mainGoals', JSON.stringify(mainGoals));
        renderMainGoals();
        closeGoalsModal();
        console.log('[GOALS] Main goals saved:', mainGoals);
    }
    
    // --- End Main Goals Functions ---

    // --- Helper Function: Format Time Difference ---
    function formatTimeDifference(date1, date2) {
        // Create copies of the dates and set time to midnight for accurate day comparisons
        const d1 = new Date(date1);
        d1.setHours(0, 0, 0, 0);
        const d2 = new Date(date2);
        d2.setHours(0, 0, 0, 0);

        const diffTime = d1.getTime() - d2.getTime();
        const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24)); // Difference in days

        if (diffDays === 0) {
            return "(Today)";
        } else if (diffDays === 1) {
            return "(Tomorrow)";
        } else if (diffDays === -1) {
            return "(Yesterday)";
        } else if (diffDays > 1) {
            return `(in ${diffDays} days)`;
        } else { // diffDays < -1
            return `(${-diffDays} days ago)`;
        }
    }
    // --- End Helper Function ---

    // --- Rendering Functions ---

    // Renders a single month into a specific grid/header element
    function renderCalendar(targetDate, gridElement, monthYearElement) {
        console.log(`[NEW RENDER] Starting renderCalendar for ${targetDate.toDateString()}`);
        const globalNotes = window.calendarNotes;

        const nowDate = new Date();
        nowDate.setHours(0, 0, 0, 0);
        const todayYear = nowDate.getFullYear();
        const todayMonth = nowDate.getMonth();
        const todayDay = nowDate.getDate();

        gridElement.innerHTML = ''; // Clear previous grid content VERY FIRST

        const year = targetDate.getFullYear();
        const month = targetDate.getMonth(); // 0-indexed

        monthYearElement.textContent = `${targetDate.toLocaleString('default', { month: 'long' })} ${year}`;
        console.log(`[NEW RENDER] Rendering month: ${month + 1}/${year}`);

        const firstDayOfMonth = new Date(year, month, 1);
        const firstDayIndex = firstDayOfMonth.getDay(); // 0 (Sunday) to 6 (Saturday)

        const lastDayOfMonth = new Date(year, month + 1, 0);
        const daysInMonth = lastDayOfMonth.getDate();

        console.log(`[NEW RENDER] ${month + 1}/${year}: First day is index ${firstDayIndex}, ${daysInMonth} days total.`);

        // Use a DocumentFragment for performance and atomic updates
        const fragment = document.createDocumentFragment();

        // Add day headers (Sun-Sat)
        const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        dayNames.forEach(name => {
            const dayHeader = document.createElement('div');
            dayHeader.classList.add('day-header');
            dayHeader.textContent = name;
            fragment.appendChild(dayHeader);
        });

        // Add empty cells for days before the 1st of the month
        for (let i = 0; i < firstDayIndex; i++) {
            const emptyDayCell = document.createElement('div');
            emptyDayCell.classList.add('day', 'other-month');
            fragment.appendChild(emptyDayCell);
        }

        // Add cells for each day of the month
        for (let dayNum = 1; dayNum <= daysInMonth; dayNum++) {
            const currentDateOfLoop = new Date(year, month, dayNum);
            const dateString = `${year}-${String(month + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;

            const dayCell = document.createElement('div');
            dayCell.classList.add('day');
            dayCell.dataset.date = dateString;
            dayCell.dataset.dayNum = dayNum; // For easier debugging

            // Visual Debug: Add a border to all cells initially
            // dayCell.style.border = '1px dotted blue'; 

            const dayNumberElement = document.createElement('div');
            dayNumberElement.classList.add('day-number');
            dayNumberElement.textContent = dayNum;
            dayCell.appendChild(dayNumberElement);

            const isToday = (dayNum === todayDay && month === todayMonth && year === todayYear);
            if (isToday) {
                dayCell.classList.add('today');
                console.log(`[NEW RENDER] Marked as TODAY: ${dateString}.`);
                // ---- TEMPORARY DEV STYLES FOR TODAY - REMOVED ----
                // dayCell.style.backgroundColor = 'lime';
                // dayCell.style.border = '3px solid red';
                // dayCell.style.color = 'black';
                // dayCell.style.fontWeight = '900';
                // dayCell.style.setProperty('outline', '3px dashed blue', 'important');
                // dayCell.style.setProperty('z-index', '9999', 'important');
                // dayCell.style.setProperty('opacity', '1', 'important');
                // dayCell.style.setProperty('transform', 'scale(1.1)', 'important');
                // ------------------------------------------
            }

            // --- Display Events --- 
            const eventsForDay = globalNotes[dateString] || [];
            const eventsContainer = document.createElement('div');
            eventsContainer.classList.add('day-events');

            if (eventsForDay.length === 1) {
                const eventTextElement = document.createElement('div');
                eventTextElement.classList.add('note-text', 'single-event');
                let displayText = eventsForDay[0].text || '(No description)';
                if (eventsForDay[0].time) displayText = `${eventsForDay[0].time} - ${displayText}`; 
                eventTextElement.textContent = displayText;
                eventsContainer.appendChild(eventTextElement);
            } else if (eventsForDay.length > 1) {
                const eventCountElement = document.createElement('div');
                eventCountElement.classList.add('note-text', 'event-count');
                eventCountElement.textContent = `${eventsForDay.length} Events`;
                eventsContainer.appendChild(eventCountElement);
            }
            dayCell.appendChild(eventsContainer);
            // --- End Display Events ---

            dayCell.addEventListener('click', () => openNoteModal(dateString));
            fragment.appendChild(dayCell);
        }

        // Append the entire fragment to the grid at once
        gridElement.appendChild(fragment);
        console.log(`[NEW RENDER] Appended all day cells for ${month + 1}/${year}. Total children in grid: ${gridElement.children.length}`);
    }

    // Renders two adjacent months for desktop
    function renderDesktopView() {
        const firstMonthDate = new Date(desktopMonthDate);
        const secondMonthDate = new Date(desktopMonthDate);
        secondMonthDate.setMonth(secondMonthDate.getMonth() + 1);

        renderCalendar(firstMonthDate, calendarGrid1, monthYearElement1);
        renderCalendar(secondMonthDate, calendarGrid2, monthYearElement2);

        // Update the main control header for desktop view
        const month1Name = firstMonthDate.toLocaleString('default', { month: 'long' });
        const month2Name = secondMonthDate.toLocaleString('default', { month: 'long' });
        const year1 = firstMonthDate.getFullYear();
        const year2 = secondMonthDate.getFullYear();
        monthYearDisplayElement.textContent = year1 === year2 ? `${month1Name} & ${month2Name} ${year1}` : `${month1Name} ${year1} & ${month2Name} ${year2}`;
    }
    
    // Renders the mobile month view (uses renderCalendar)
    function renderMobileMonthView() {
        renderCalendar(mobileMonthDate, calendarGrid1, monthYearElement1);
        monthYearDisplayElement.textContent = mobileMonthDate.toLocaleString('default', { month: 'long', year: 'numeric' });
    }

    // Renders the mobile two-week view with consistent today highlighting
    function renderMobileTwoWeekView() {
        console.log(`[NEW MOBILE RENDER] Starting renderMobileTwoWeekView`);
        const globalNotes = window.calendarNotes;

        const nowDate = new Date();
        nowDate.setHours(0, 0, 0, 0);
        const todayYear = nowDate.getFullYear();
        const todayMonth = nowDate.getMonth();
        const todayDay = nowDate.getDate();

        calendarGrid1.innerHTML = ''; // Clear previous grid content VERY FIRST

        const viewStartDate = new Date(mobileWeekStartDate);
        viewStartDate.setHours(0, 0, 0, 0);

        const viewEndDate = new Date(viewStartDate);
        viewEndDate.setDate(viewStartDate.getDate() + 13); // 14 days total

        const headerOptions = { month: 'short', day: 'numeric' };
        monthYearElement1.textContent = `${viewStartDate.toLocaleDateString('default', headerOptions)} - ${viewEndDate.toLocaleDateString('default', headerOptions)}, ${viewStartDate.getFullYear()}`;
        monthYearDisplayElement.textContent = `${viewStartDate.toLocaleDateString('default', { month: 'long', year: 'numeric' })}`;
        console.log(`[NEW MOBILE RENDER] Rendering 2-week view from: ${viewStartDate.toDateString()} to ${viewEndDate.toDateString()}`);

        const fragment = document.createDocumentFragment();

        // Add day headers (Sun-Sat) for the first week shown in the two-week view for context
        const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        for (let i = 0; i < 7; i++) {
            const dayHeader = document.createElement('div');
            dayHeader.classList.add('day-header', 'mobile-week-header');
            // We can set textContent to dayNames[ (viewStartDate.getDay() + i) % 7 ] if we want dynamic headers for the week view starting day
            // For simplicity, or if the visual grid doesn't always start on Sunday for the *data* but visually *does* for the headers, we might just use fixed headers.
            // Let's assume the visual grid header row is always Sun-Sat for this display.
            dayHeader.textContent = dayNames[i];
            fragment.appendChild(dayHeader);
        }

        // Create and add all 14 day cells
        for (let i = 0; i < 14; i++) {
            const currentDateOfLoop = new Date(viewStartDate);
            currentDateOfLoop.setDate(viewStartDate.getDate() + i);

            const year = currentDateOfLoop.getFullYear();
            const month = currentDateOfLoop.getMonth(); // 0-indexed
            const dayNum = currentDateOfLoop.getDate();
            const dateString = `${year}-${String(month + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;

            const dayCell = document.createElement('div');
            dayCell.classList.add('day', 'week-view'); // Ensure 'week-view' styles apply
            dayCell.dataset.date = dateString;
            dayCell.dataset.dayNum = dayNum;

            const dayNameElement = document.createElement('div');
            dayNameElement.classList.add('day-name');
            dayNameElement.textContent = dayNames[currentDateOfLoop.getDay()];
            dayCell.appendChild(dayNameElement);

            const dayNumberElement = document.createElement('div');
            dayNumberElement.classList.add('day-number');
            dayNumberElement.textContent = dayNum;
            dayCell.appendChild(dayNumberElement);

            const isToday = (dayNum === todayDay && month === todayMonth && year === todayYear);
            if (isToday) {
                dayCell.classList.add('today');
                console.log(`[NEW MOBILE RENDER] Marked as TODAY: ${dateString}.`);
                // ---- TEMPORARY DEV STYLES FOR TODAY - REMOVED ----
                // dayCell.style.backgroundColor = 'lime';
                // dayCell.style.border = '3px solid red';
                // dayCell.style.color = 'black';
                // dayCell.style.fontWeight = '900';
                // dayCell.style.setProperty('outline', '3px dashed blue', 'important');
                // dayCell.style.setProperty('z-index', '9999', 'important');
                // dayCell.style.setProperty('opacity', '1', 'important');
                // dayCell.style.setProperty('transform', 'scale(1.1)', 'important');
                // ------------------------------------------
            }

            // --- Display Events ---
            const eventsForDay = globalNotes[dateString] || [];
            const eventsContainer = document.createElement('div');
            eventsContainer.classList.add('day-events');

            if (eventsForDay.length === 1) {
                const eventTextElement = document.createElement('div');
                eventTextElement.classList.add('note-text', 'single-event');
                let displayText = eventsForDay[0].text || '(No description)';
                if (eventsForDay[0].time) displayText = `${eventsForDay[0].time} - ${displayText}`; 
                eventTextElement.textContent = displayText;
                eventsContainer.appendChild(eventTextElement);
            } else if (eventsForDay.length > 1) {
                const eventCountElement = document.createElement('div');
                eventCountElement.classList.add('note-text', 'event-count');
                eventCountElement.textContent = `${eventsForDay.length} Events`;
                eventsContainer.appendChild(eventCountElement);
            }
            dayCell.appendChild(eventsContainer);
            // --- End Display Events ---

            dayCell.addEventListener('click', () => openNoteModal(dateString));
            fragment.appendChild(dayCell);
        }

        calendarGrid1.appendChild(fragment);
        console.log(`[NEW MOBILE RENDER] Appended all 14 day cells. Total children in grid: ${calendarGrid1.children.length}`);
    }

    // --- Combined Render Function (Checks screen size) ---
    function renderCalendarView() {
        console.log('[CALENDAR VIEW] Starting calendar render');
        
        // Force refresh of current date to ensure today highlighting works
        const currentDate = new Date();
        currentDate.setHours(0, 0, 0, 0);
        console.log(`[CALENDAR VIEW] Current date: ${currentDate.toISOString()}`);
        
        // Reset to current month/week on first render or when explicitly requested
        if (!window.calendarInitialized || window.forceCalendarReset) {
            console.log('[CALENDAR VIEW] Initializing calendar to current date');
            
            // Set desktop view to current month
            desktopMonthDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
            desktopMonthDate.setHours(0, 0, 0, 0);
            
            // Set mobile month view to current month
            mobileMonthDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
            mobileMonthDate.setHours(0, 0, 0, 0);
            
            // Set mobile week view to include current date
            // Start the week on Sunday before the current date
            const dayOfWeek = currentDate.getDay();
            mobileWeekStartDate = new Date(currentDate);
            mobileWeekStartDate.setDate(currentDate.getDate() - dayOfWeek);
            mobileWeekStartDate.setHours(0, 0, 0, 0);
            
            console.log(`[CALENDAR VIEW] Desktop month set to: ${desktopMonthDate.toISOString()}`);
            console.log(`[CALENDAR VIEW] Mobile month set to: ${mobileMonthDate.toISOString()}`);
            console.log(`[CALENDAR VIEW] Mobile week start set to: ${mobileWeekStartDate.toISOString()}`);
            
            // Mark as initialized and reset the force flag
            window.calendarInitialized = true;
            window.forceCalendarReset = false;
        }
        
        const isDesktop = window.innerWidth > 1200;
        
        // Show/Hide second calendar and toggle button based on screen size
        calendar2Container.style.display = isDesktop ? 'block' : 'none';
        toggleViewButton.style.display = isDesktop ? 'none' : 'inline-block'; // Hide toggle on desktop
        
        if (isDesktop) {
            console.log('[CALENDAR VIEW] Rendering desktop view');
            renderDesktopView();
        } else { // Mobile view
            if (currentView === 'week') {
                console.log('[CALENDAR VIEW] Rendering mobile week view');
                renderMobileTwoWeekView();
                toggleViewButton.textContent = 'Month View';
            } else {
                console.log('[CALENDAR VIEW] Rendering mobile month view');
                renderMobileMonthView();
                toggleViewButton.textContent = 'Week View';
            }
        }
        
        // Always render progress panel
        renderEventProgressPanel();
        
        console.log('[CALENDAR VIEW] Calendar render complete');
    }

    // --- Event Progress Panel for Multiple Events ---
    function renderEventProgressPanel() {
        // Always use the global notes object
        const globalNotes = window.calendarNotes;
        
        console.log('[PROGRESS PANEL] Starting to render progress panel');
        
        // Clear existing panel content
        progressItemsContainer.innerHTML = '';
        
        // Get all dates with events
        const datesWithEvents = Object.entries(globalNotes);
        console.log('[PROGRESS PANEL] Found', datesWithEvents.length, 'dates with events');
        
        // Empty check for test mode
        if (datesWithEvents.length === 0) {
            const noEventsMessage = document.createElement('div');
            noEventsMessage.classList.add('no-events-message-panel');
            noEventsMessage.textContent = 'No events with checklists. Add some events to see them here!';
            progressItemsContainer.appendChild(noEventsMessage);
            return;
        }
        
        // Filter to include only events with checklists and sort by date
        let eventsWithChecklists = [];
        
        datesWithEvents.forEach(([dateString, eventsArray]) => {
            console.log(`Processing date ${dateString} with ${eventsArray.length} events`);
            
            // For each date, filter to events with checklists
            const dateEvents = eventsArray.filter(event => {
                const hasChecklist = event.checklist && event.checklist.length > 0;
                console.log(`Event ${event.id}: has checklist = ${hasChecklist}, items: ${event.checklist ? event.checklist.length : 0}`);
                return hasChecklist;
            });
            
            console.log(`Found ${dateEvents.length} events with checklists for ${dateString}`);
            
            // Add date and event details to our array
            dateEvents.forEach(event => {
                eventsWithChecklists.push({
                    dateString,
                    event
                });
            });
        });
        
        console.log('Total events with checklists:', eventsWithChecklists.length);
        
        // Sort by date
        eventsWithChecklists.sort((a, b) => new Date(a.dateString) - new Date(b.dateString));
        
        // If no events with checklists, show message
        if (eventsWithChecklists.length === 0) {
            const noEventsMessage = document.createElement('div');
            noEventsMessage.classList.add('no-events-message-panel');
            noEventsMessage.textContent = 'No upcoming events with checklists. Add some checklists to your events!';
            progressItemsContainer.appendChild(noEventsMessage);
            return;
        }
        
        // Group events by date for the panel
        const groupedByDate = {};
        
        eventsWithChecklists.forEach(item => {
            if (!groupedByDate[item.dateString]) {
                groupedByDate[item.dateString] = [];
            }
            groupedByDate[item.dateString].push(item.event);
        });
        
        // Create and append elements for each date
        Object.entries(groupedByDate).forEach(([dateString, events]) => {
            // Create the card container
            const itemContainer = document.createElement('div');
            itemContainer.classList.add('progress-item');

            // Create header section with date
            const headerSection = document.createElement('div');
            headerSection.classList.add('progress-item-header');
            
            // Add Date
            const itemDate = document.createElement('span');
            itemDate.classList.add('item-date');
            const [year, month, day] = dateString.split('-');
            const dateObj = new Date(year, month-1, day);
            
            // Format date with day of week and relative time indicator
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const relativeTimeStr = formatTimeDifference(dateObj, today);
            
            itemDate.textContent = `${dateObj.toLocaleDateString('en-US', { 
                weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' 
            })} ${relativeTimeStr}`;
            
            headerSection.appendChild(itemDate);

            // Add Date Text
            const itemText = document.createElement('div');
            itemText.classList.add('item-text');
            itemText.textContent = `${events.length} event${events.length > 1 ? 's' : ''}`;
            headerSection.appendChild(itemText);
            
            itemContainer.appendChild(headerSection);

            // Add Events Container
            const eventsContainer = document.createElement('div');
            eventsContainer.classList.add('events-container');
            
            // Add each event
            events.forEach((event, index) => {
                const eventDiv = document.createElement('div');
                eventDiv.className = 'panel-event';
                
                // Create event header with time, text and edit button
                const eventHeader = document.createElement('div');
                eventHeader.classList.add('panel-event-header');
                
                // Add event time and text
                const eventDetails = document.createElement('div');
                eventDetails.classList.add('panel-event-details');
                
                if (event.time) {
                    const timeElement = document.createElement('span');
                    timeElement.classList.add('panel-event-time');
                    timeElement.textContent = event.time;
                    eventDetails.appendChild(timeElement);
                }
                
                const textElement = document.createElement('span');
                textElement.classList.add('panel-event-text');
                textElement.textContent = event.text || '(No description)';
                eventDetails.appendChild(textElement);
                
                eventHeader.appendChild(eventDetails);
                
                // Create edit button
                const editButton = document.createElement('button');
                editButton.className = 'panel-event-edit';
                editButton.innerHTML = '<span class="edit-icon">✎</span> Edit';
                editButton.addEventListener('click', (e) => {
                    e.stopPropagation();
                    openNoteModal(dateString);
                    // Find and click the event in the modal to edit it
                    setTimeout(() => {
                        const eventItems = eventsListElement.querySelectorAll('.event-item');
                        eventItems.forEach(item => {
                            if (item.dataset.eventId == event.id) {
                                item.click();
                            }
                        });
                    }, 100);
                });
                
                eventHeader.appendChild(editButton);
                eventDiv.appendChild(eventHeader);
                
                // Add checklist progress for this event
                if (event.checklist && event.checklist.length > 0) {
                    const totalItems = event.checklist.length;
                    const completedItems = event.checklist.filter(item => item.done).length;
                    const percent = totalItems > 0 ? (completedItems / totalItems) * 100 : 0;

            const progressContainer = document.createElement('div');
            progressContainer.classList.add('progress-container');
            
            const progressBarContainer = document.createElement('div');
            progressBarContainer.classList.add('progress-bar-container');
            
            const progressBar = document.createElement('div');
            progressBar.classList.add('progress-bar');
                    progressBar.style.width = `${percent}%`;
            
            progressBarContainer.appendChild(progressBar);
            progressContainer.appendChild(progressBarContainer);

            const progressSummary = document.createElement('div');
            progressSummary.classList.add('progress-summary');
                    progressSummary.textContent = `${completedItems}/${totalItems} Tasks`;
                    
                    // Add toggle button
                    const toggleButton = document.createElement('button');
                    toggleButton.classList.add('toggle-checklist-button');
                    toggleButton.textContent = 'Hide Tasks';
                    toggleButton.addEventListener('click', (e) => {
                        e.stopPropagation(); // Prevent event bubble to parent
                        const checklistContainer = e.target.nextElementSibling;
                        if (checklistContainer.style.display === 'none' || !checklistContainer.style.display) {
                            checklistContainer.style.display = 'block';
                            e.target.textContent = 'Hide Tasks';
                        } else {
                            checklistContainer.style.display = 'none';
                            e.target.textContent = 'Show Tasks';
                        }
                    });
                    
                    // Create checklist container (initially visible)
            const checklistContainer = document.createElement('div');
                    checklistContainer.classList.add('panel-checklist-container');
                    checklistContainer.style.display = 'block';
            
                    // Add checklist items
                    const checklistUl = document.createElement('ul');
                    checklistUl.classList.add('panel-checklist');

                    // Add clickable checklist items
                    event.checklist.forEach((item, index) => {
                const li = document.createElement('li');

                // Create checkbox with proper event handler
                const checkbox = document.createElement('input');
                checkbox.type = 'checkbox';
                checkbox.id = `panel-cb-${event.id}-${index}`;
                checkbox.checked = item.done;
                
                // Create label once
                const label = document.createElement('label');
                label.classList.add('panel-checklist-label');
                label.htmlFor = checkbox.id;
                label.textContent = item.task;
                
                if (item.done) {
                    label.classList.add('completed');
                }

                // Create promote to goal button
                const promoteButton = document.createElement('button');
                promoteButton.classList.add('promote-goal-button');
                promoteButton.innerHTML = '<span class="promote-icon"></span>Add';
                promoteButton.title = 'Add to main goals';
                
                // Prevent event propagation to parent
                checkbox.addEventListener('click', (e) => {
                    e.stopPropagation(); // Prevent opening edit modal
                });
                
                label.addEventListener('click', (e) => {
                    e.stopPropagation(); // Prevent opening edit modal
                });
                
                promoteButton.addEventListener('click', (e) => {
                    e.stopPropagation(); // Prevent opening edit modal
                    promoteTaskToMainGoal(item.task, dateString);
                });
                
                // Add event listener for checkbox changes
                checkbox.addEventListener('change', (e) => {
                    // Always use the global notes object
                    const globalNotes = window.calendarNotes;
                    
                    // Update the checked state in the UI
                    label.classList.toggle('completed', checkbox.checked);
                    
                    // Find and update the item in the data structure
                    const updatedEvents = globalNotes[dateString] || [];
                    const eventIndex = updatedEvents.findIndex(e => e.id === event.id);
                    
                    if (eventIndex !== -1) {
                        const checklistItems = updatedEvents[eventIndex].checklist || [];
                        const itemIndex = checklistItems.findIndex(i => i.task === item.task);
                        
                        if (itemIndex !== -1) {
                            // Update the done state
                            checklistItems[itemIndex].done = checkbox.checked;
                            
                            // Update in the data structure
                            updatedEvents[eventIndex].checklist = checklistItems;
                            globalNotes[dateString] = updatedEvents;
                            // Update local reference
                            notes = globalNotes;
                            
                            // Update progress bar
                            const totalItems = checklistItems.length;
                            const completedItems = checklistItems.filter(i => i.done).length;
                            const percent = totalItems > 0 ? (completedItems / totalItems) * 100 : 0;
                            progressBar.style.width = `${percent}%`;
                            progressSummary.textContent = `${completedItems}/${totalItems} Tasks`;
                            
                            // Save to Firebase if signed in
                            if (firebase.auth().currentUser) {
                                saveNotesToFirebase();
                                console.log('[CHECKBOX] Saved change to Firebase');
                            } else {
                                console.log('[CHECKBOX] Test mode: Checklist update saved to memory only');
                            }
                        }
                    }
                });

                        // Append all elements to the list item
                        li.appendChild(checkbox);
                        li.appendChild(label);
                        li.appendChild(promoteButton);
                        
                        // Append the list item to the checklist
                        checklistUl.appendChild(li);
                    });
                    
                    checklistContainer.appendChild(checklistUl);
                    progressContainer.appendChild(progressSummary);
                    
                    eventDiv.appendChild(progressContainer);
                    eventDiv.appendChild(toggleButton);
                    eventDiv.appendChild(checklistContainer);
                }
                
                eventsContainer.appendChild(eventDiv);
            });
            
            itemContainer.appendChild(eventsContainer);
            progressItemsContainer.appendChild(itemContainer);
        });
    }

    // --- Modal Functions ---
    function openNoteModal(dateString) {
        // TEST MODE: Allow adding notes without signing in
        // if (!firebase.auth().currentUser) {
        //     alert("Please sign in to add or view notes");
        //     return;
        // }
        
        console.log('------ OPENING NOTE MODAL ------');
        console.log('Opening modal for date:', dateString);
        
        selectedDateString = dateString;
        const [year, month, day] = dateString.split('-');
        const dateObj = new Date(year, month - 1, day);
        modalDateElement.textContent = dateObj.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
        
        // Reset any editing state
        hideEditEventSection();
        
        // Reset new event form - ensure all fields are cleared
        newEventTimeElement.value = '';
        newEventTextElement.value = '';
        newEventChecklistElement.innerHTML = '';
        newChecklistItemElement.value = '';
        
        // Ensure the add event section is visible
        const addEventSection = document.getElementById('add-event-section');
        if (addEventSection) {
            addEventSection.style.display = 'block';
        }
        
        // Display events for this date
        displayEventsInModal();
        
        // Show the modal
        noteModal.style.display = 'block';
        
        console.log('------ NOTE MODAL OPENED ------');
    }

    function closeNoteModal() {
        noteModal.style.display = 'none';
        selectedDateString = null;
        currentEditingEventId = null;
    }
    
    // Display all events for the selected date
    function displayEventsInModal() {
        // Always use the global notes object
        const globalNotes = window.calendarNotes;
        
        // Get events for the selected date
        const eventsForDay = globalNotes[selectedDateString] || [];
        
        console.log('[DISPLAY EVENTS] For date:', selectedDateString);
        console.log('[DISPLAY EVENTS] Total events:', eventsForDay.length);
        
        // Clear the events list
        eventsListElement.innerHTML = '';
        
        if (eventsForDay.length === 0) {
            // Show "no events" message
            const noEventsMessage = document.createElement('div');
            noEventsMessage.classList.add('no-events-message');
            noEventsMessage.textContent = 'No events for this day. Add one below.';
            eventsListElement.appendChild(noEventsMessage);
        } else {
            // Create and display each event in the list
            eventsForDay.forEach((event, index) => {
                console.log(`[DISPLAY EVENTS] Rendering event ${index+1}:`, event.id);
                
                const eventItem = document.createElement('div');
                eventItem.classList.add('event-item');
                eventItem.dataset.eventId = event.id; // Store event ID for editing
                
                // Time section (if exists)
                const timeElement = document.createElement('div');
                timeElement.classList.add('event-time');
                timeElement.textContent = event.time || '-';
                
                // Text section (description)
                const textElement = document.createElement('div');
                textElement.classList.add('event-text');
                textElement.textContent = event.text || '(No description)';
                
                // Checklist indicator (if has checklist)
                if (event.checklist && event.checklist.length > 0) {
                    const completedItems = event.checklist.filter(item => item.done).length;
                    const checklistIndicator = document.createElement('div');
                    checklistIndicator.classList.add('event-checklist-indicator');
                    checklistIndicator.textContent = `✓ ${completedItems}/${event.checklist.length}`;
                    eventItem.appendChild(timeElement);
                    eventItem.appendChild(textElement);
                    eventItem.appendChild(checklistIndicator);
                } else {
                    eventItem.appendChild(timeElement);
                    eventItem.appendChild(textElement);
                }
                
                // Add click handler to edit this event
                eventItem.addEventListener('click', () => {
                    handleEditEvent(event);
                });
                
                eventsListElement.appendChild(eventItem);
            });
        }
    }
    
    // Render checklist for new event
    function renderChecklistForNewEvent(checklist = []) {
        newEventChecklistElement.innerHTML = '';
        
        checklist.forEach((item, index) => {
            const li = document.createElement('li');

            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.checked = item.done;
            checkbox.id = `new-item-${index}`;
            
            const label = document.createElement('label');
            label.htmlFor = `new-item-${index}`;
            label.textContent = item.task;
            if (item.done) {
                label.classList.add('completed');
            }
            
            // Add promote to goal button
            const promoteButton = document.createElement('button');
            promoteButton.classList.add('promote-goal-button');
            promoteButton.innerHTML = '<span class="promote-icon"></span>Add';
            promoteButton.title = 'Add to main goals';
            promoteButton.addEventListener('click', (e) => {
                e.stopPropagation();
                promoteTaskToMainGoal(item.task, selectedDateString);
            });
            
            const deleteButton = document.createElement('button');
            deleteButton.classList.add('delete-item-button');
            deleteButton.innerHTML = '&times;';
            deleteButton.addEventListener('click', (e) => {
                e.stopPropagation(); // Prevent event from bubbling up
                li.remove();
            });
            
            checkbox.addEventListener('change', () => {
                label.classList.toggle('completed', checkbox.checked);
            });
            
            li.appendChild(checkbox);
            li.appendChild(label);
            li.appendChild(promoteButton);
            li.appendChild(deleteButton);
            newEventChecklistElement.appendChild(li);
        });
    }
    
    // Render checklist for edit section
    function renderChecklistForEditEvent(checklist = []) {
        editEventChecklistElement.innerHTML = '';
        
        checklist.forEach((item, index) => {
            const li = document.createElement('li');
            
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.checked = item.done;
            checkbox.id = `edit-item-${index}`;

            const label = document.createElement('label');
            label.htmlFor = `edit-item-${index}`;
            label.textContent = item.task;
            if (item.done) {
                label.classList.add('completed');
            }

            const deleteButton = document.createElement('button');
            deleteButton.classList.add('delete-item-button');
            deleteButton.innerHTML = '&times;';
            deleteButton.addEventListener('click', (e) => {
                e.stopPropagation(); // Prevent event from bubbling up
                li.remove();
            });
            
            // Add promote to goal button
            const promoteButton = document.createElement('button');
            promoteButton.classList.add('promote-goal-button');
            promoteButton.innerHTML = '<span class="promote-icon"></span>Add';
            promoteButton.title = 'Add to main goals';
            promoteButton.addEventListener('click', (e) => {
                e.stopPropagation();
                promoteTaskToMainGoal(item.task, selectedDateString);
            });
            
            checkbox.addEventListener('change', () => {
                label.classList.toggle('completed', checkbox.checked);
            });

            li.appendChild(checkbox);
            li.appendChild(label);
            li.appendChild(promoteButton);
            li.appendChild(deleteButton);
            editEventChecklistElement.appendChild(li);
        });
    }
    
    // Function to gather checklist data from UI
    function getChecklistFromUI(checklistElement) {
        const checklist = [];
        const items = checklistElement.querySelectorAll('li');
        
        console.log(`Getting checklist from UI, found ${items.length} items`);
        
        items.forEach((li, index) => {
            const checkbox = li.querySelector('input[type="checkbox"]');
            const label = li.querySelector('label');
            
            if (checkbox && label) {
                const item = {
                    task: label.textContent,
                    done: checkbox.checked
                };
                console.log(`Checklist item ${index}: "${item.task}", done: ${item.done}`);
                checklist.push(item);
            } else {
                console.log(`Checklist item ${index}: missing checkbox or label elements`);
            }
        });
        
        console.log('Final checklist items:', checklist);
        return checklist;
    }
    
    // Function to add checklist item to new event form
    function addNewEventChecklistItem() {
        const taskText = newChecklistItemElement.value.trim();
        if (taskText) {
            const item = { task: taskText, done: false };
            
            const li = document.createElement('li');

            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.id = `new-item-${Date.now()}`; // Use timestamp for unique ID
            
            const label = document.createElement('label');
            label.htmlFor = checkbox.id;
            label.textContent = item.task;
            
            // Add promote to goal button
            const promoteButton = document.createElement('button');
            promoteButton.classList.add('promote-goal-button');
            promoteButton.innerHTML = '<span class="promote-icon"></span>Add';
            promoteButton.title = 'Add to main goals';
            promoteButton.addEventListener('click', (e) => {
                e.stopPropagation();
                promoteTaskToMainGoal(item.task, selectedDateString);
            });
            
            const deleteButton = document.createElement('button');
            deleteButton.classList.add('delete-item-button');
            deleteButton.innerHTML = '&times;';
            deleteButton.addEventListener('click', (e) => {
                e.stopPropagation();
                li.remove();
            });
            
            checkbox.addEventListener('change', () => {
                label.classList.toggle('completed', checkbox.checked);
            });
            
            li.appendChild(checkbox);
            li.appendChild(label);
            li.appendChild(promoteButton);
            li.appendChild(deleteButton);
            newEventChecklistElement.appendChild(li);
            
            newChecklistItemElement.value = '';
        }
    }
    
    // Function to add checklist item to edit event form
    function addEditEventChecklistItem() {
        const taskText = editChecklistItemElement.value.trim();
        if (taskText) {
            const item = { task: taskText, done: false };
            
            const li = document.createElement('li');
            
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.id = `edit-item-${Date.now()}`; // Use timestamp for unique ID

            const label = document.createElement('label');
            label.htmlFor = checkbox.id;
            label.textContent = item.task;

            const deleteButton = document.createElement('button');
            deleteButton.classList.add('delete-item-button');
            deleteButton.innerHTML = '&times;';
            deleteButton.addEventListener('click', (e) => {
                e.stopPropagation();
                 li.remove();
            });
            
            // Add promote to goal button
            const promoteButton = document.createElement('button');
            promoteButton.classList.add('promote-goal-button');
            promoteButton.innerHTML = '<span class="promote-icon"></span>Add';
            promoteButton.title = 'Add to main goals';
            promoteButton.addEventListener('click', (e) => {
                e.stopPropagation();
                promoteTaskToMainGoal(item.task, selectedDateString);
            });
            
            checkbox.addEventListener('change', () => {
                label.classList.toggle('completed', checkbox.checked);
            });

            li.appendChild(checkbox);
            li.appendChild(label);
            li.appendChild(promoteButton);
            li.appendChild(deleteButton);
            editEventChecklistElement.appendChild(li);
            
            editChecklistItemElement.value = '';
        }
    }
    
    // Add a new event - completely rewritten for reliability
    function addEvent() {
        if (!selectedDateString) {
            console.error('Cannot add event: No date selected');
            return;
        }
        
        const eventText = newEventTextElement.value.trim();
        const eventTime = newEventTimeElement.value;
        const checklist = getChecklistFromUI(newEventChecklistElement);
        
        console.log('[EVENT ADD] Starting to add new event for date:', selectedDateString);
        
        // Only save if there's content
        if (eventText || checklist.length > 0) {
            // Create new event object with guaranteed unique ID
            const uniqueId = Date.now() + '-' + Math.random().toString(36).substr(2, 9);
            const newEvent = {
                id: uniqueId,
                text: eventText,
                time: eventTime,
                checklist: checklist
            };
            
            console.log('[EVENT ADD] Created new event object:', newEvent);
            
            // Make sure we have direct access to global notes storage
            const globalNotes = window.calendarNotes;
            
            // IMPORTANT: Initialize array if needed with a fresh empty array
            if (!globalNotes[selectedDateString]) {
                globalNotes[selectedDateString] = [];
                console.log('[EVENT ADD] Initialized empty array for date:', selectedDateString);
            }
            
            // Add new event to the global notes array
            globalNotes[selectedDateString].push(newEvent);
            
            // Make sure our local reference is updated
            notes = globalNotes;
            
            console.log('[EVENT ADD] Updated notes array, now has', 
                globalNotes[selectedDateString].length, 'events for date', selectedDateString);
            
            // Save to Firebase if signed in, otherwise just update UI
            if (firebase.auth().currentUser) {
                saveNotesToFirebase()
                    .then(() => {
                        // Clear form fields BEFORE updating UI
                        newEventTimeElement.value = '';
                        newEventTextElement.value = '';
                        newEventChecklistElement.innerHTML = '';
                        newChecklistItemElement.value = '';
                        
                        // Update UI after firebase save completes
                        updateUIAfterEventChange();
                        console.log('[EVENT ADD] Event saved to Firebase');
                    })
                    .catch(error => {
                        console.error('[EVENT ADD] Error saving to Firebase:', error);
                        alert('There was an error saving your event. Please try again.');
                    });
            } else {
                // TEST MODE: No Firebase, just update UI
                // Clear form fields BEFORE updating UI
                newEventTimeElement.value = '';
                newEventTextElement.value = '';
                newEventChecklistElement.innerHTML = '';
                newChecklistItemElement.value = '';
                
                // Update UI with the new event
                updateUIAfterEventChange();
                console.log('Test mode: Event saved to memory only');
            }
            
            console.log('---------- EVENT ADDED ----------');
            console.log('Total events for all dates:', Object.values(notes).reduce((count, events) => count + events.length, 0));
        } else {
            console.warn('Event not added: No content provided');
        }
    }
    
    // Show edit event section for selected event
    function handleEditEvent(event) {
        currentEditingEventId = event.id;
        
        // Fill the edit form with event data
        editEventTimeElement.value = event.time || '';
        editEventTextElement.value = event.text || '';
        renderChecklistForEditEvent(event.checklist || []);
        
        // Show edit section, hide add section
        editEventSection.style.display = 'block';
    }
    
    // Hide the edit event section
    function hideEditEventSection() {
        editEventSection.style.display = 'none';
        currentEditingEventId = null;
        editEventTimeElement.value = '';
        editEventTextElement.value = '';
        editEventChecklistElement.innerHTML = '';
    }
    
    // Save edited event
    function saveEditedEvent() {
        if (!selectedDateString || !currentEditingEventId) {
            return;
        }
        
        const eventText = editEventTextElement.value.trim();
        const eventTime = editEventTimeElement.value;
        const checklist = getChecklistFromUI(editEventChecklistElement);
        
        console.log('[EDIT EVENT] Saving event ID:', currentEditingEventId);
        
        // Always use the global notes object
        const globalNotes = window.calendarNotes;
        
        // Find the event in the array
        const eventsForDay = globalNotes[selectedDateString] || [];
        const eventIndex = eventsForDay.findIndex(e => e.id === currentEditingEventId);
        
        if (eventIndex !== -1) {
            // Update event data
            eventsForDay[eventIndex] = {
                id: currentEditingEventId,
                text: eventText,
                time: eventTime,
                checklist: checklist
            };
            
            // Update global notes
            globalNotes[selectedDateString] = eventsForDay;
            // Update local reference
            notes = globalNotes;
            
            console.log('[EDIT EVENT] Updated event at index', eventIndex);
            
            // Save to Firebase if signed in, otherwise just update UI
            if (firebase.auth().currentUser) {
                saveNotesToFirebase().then(() => {
                    updateUIAfterEventChange();
                    console.log('[EDIT EVENT] Saved changes to Firebase');
                });
            } else {
                // TEST MODE: Just update UI without Firebase
                updateUIAfterEventChange();
                console.log('[EDIT EVENT] Saved changes to memory only (test mode)');
            }
        } else {
            console.error('[EDIT EVENT] Event not found with ID:', currentEditingEventId);
        }
    }
    
    // Delete an event
    function handleDeleteEvent() {
        if (!selectedDateString || !currentEditingEventId) {
            return;
        }
        
        console.log('[DELETE EVENT] Deleting event ID:', currentEditingEventId);
        
        // Always use the global notes object
        const globalNotes = window.calendarNotes;
        
        // Find the event in the array
        const eventsForDay = globalNotes[selectedDateString] || [];
        const eventIndex = eventsForDay.findIndex(e => e.id === currentEditingEventId);
        
        if (eventIndex !== -1) {
            // Remove the event from the array
            eventsForDay.splice(eventIndex, 1);
            
            // If no events left, delete the date entry
            if (eventsForDay.length === 0) {
                delete globalNotes[selectedDateString];
            } else {
                globalNotes[selectedDateString] = eventsForDay;
            }
            
            // Update local reference
            notes = globalNotes;
            
            console.log('[DELETE EVENT] Event removed, remaining events:', 
                globalNotes[selectedDateString] ? globalNotes[selectedDateString].length : 0);
            
            // Save to Firebase if signed in, otherwise just update UI
            if (firebase.auth().currentUser) {
                saveNotesToFirebase().then(() => {
                    updateUIAfterEventChange();
                    console.log('[DELETE EVENT] Change saved to Firebase');
                });
            } else {
                // TEST MODE: Just update UI without Firebase
                updateUIAfterEventChange();
                console.log('[DELETE EVENT] Change saved to memory only (test mode)');
            }
        } else {
            console.error('[DELETE EVENT] Event not found with ID:', currentEditingEventId);
        }
    }
    
    // Helper function to update UI after event changes
    function updateUIAfterEventChange() {
        // Always use the global notes object
        const globalNotes = window.calendarNotes;

        console.log('[UI UPDATE] Starting UI refresh');
        
        // Hide edit section
        hideEditEventSection();
        
        // Refresh the events list
        displayEventsInModal();
        
        // Update calendar view
        renderCalendarView();
        
        // Log the current state
        console.log('[UI UPDATE] Completed. Events for date', selectedDateString + ':',
            globalNotes[selectedDateString] ? globalNotes[selectedDateString].length : 0);
        console.log('[UI UPDATE] Total events in calendar:', countTotalEvents());
    }
    
    // Save notes to Firebase
    function saveNotesToFirebase() {
        return new Promise((resolve, reject) => {
            const user = firebase.auth().currentUser;
            if (!user) {
                reject(new Error('User not logged in'));
                return;
            }
            
            // Always use the global notes object for saving
            const globalNotes = window.calendarNotes;
            
            db.collection('userNotes').doc(user.uid).set({ 
                notes: globalNotes,
                mainGoals: mainGoals
            })
                .then(() => {
                    console.log('[FIREBASE] Notes and goals saved successfully');
                    resolve();
                })
                .catch(error => {
                    console.error("[FIREBASE] Error saving notes:", error);
                    alert("Error saving to cloud: " + error.message);
                    reject(error);
                });
        });
    }

    // --- Event Listeners ---
    prevButton.addEventListener('click', () => {
        const isDesktop = window.innerWidth > 1200;
        if (isDesktop) {
            desktopMonthDate.setMonth(desktopMonthDate.getMonth() - 1);
        } else {
            if (currentView === 'week') {
                mobileWeekStartDate.setDate(mobileWeekStartDate.getDate() - 7);
            } else {
                mobileMonthDate.setMonth(mobileMonthDate.getMonth() - 1);
            }
        }
        renderCalendarView();
    });

    nextButton.addEventListener('click', () => {
        const isDesktop = window.innerWidth > 1200;
        if (isDesktop) {
            desktopMonthDate.setMonth(desktopMonthDate.getMonth() + 1);
        } else {
             if (currentView === 'week') {
                mobileWeekStartDate.setDate(mobileWeekStartDate.getDate() + 7);
            } else {
                mobileMonthDate.setMonth(mobileMonthDate.getMonth() + 1);
            }
        }
        renderCalendarView();
    });

    // Toggle view only affects mobile
    toggleViewButton.addEventListener('click', () => {
        currentView = (currentView === 'week') ? 'month' : 'week';
        if (currentView === 'month') {
             // When switching to month view, set month based on current week view start date
            mobileMonthDate = new Date(mobileWeekStartDate);
            mobileMonthDate.setDate(1);
        } else {
            // When switching back to week view, reset to today
             mobileWeekStartDate = new Date(); 
             mobileWeekStartDate.setHours(0, 0, 0, 0);
        }
        renderCalendarView(); // Re-render mobile view
    });

    // Modal event listeners
    closeButton.addEventListener('click', closeNoteModal);
    
    // Add new event
    addEventButton.addEventListener('click', addEvent);
    
    // Add checklist item to new event
    addItemButton.addEventListener('click', addNewEventChecklistItem);
    newChecklistItemElement.addEventListener('keypress', (event) => {
        if (event.key === 'Enter') {
            addNewEventChecklistItem();
        }
    });
    
    // Add checklist item to edit event
    editAddItemButton.addEventListener('click', addEditEventChecklistItem);
    editChecklistItemElement.addEventListener('keypress', (event) => {
        if (event.key === 'Enter') {
            addEditEventChecklistItem();
        }
    });
    
    // Edit event actions
    saveEditedEventButton.addEventListener('click', saveEditedEvent);
    cancelEditButton.addEventListener('click', hideEditEventSection);
    deleteEventButton.addEventListener('click', handleDeleteEvent);

    // Close modal on outside click
    window.addEventListener('click', (event) => {
        if (event.target == noteModal) {
            closeNoteModal();
        }
        if (event.target == goalsModal) {
            closeGoalsModal();
        }
    });

    // Main Goals event listeners
    editGoalsButton.addEventListener('click', openGoalsModal);
    goalsCloseButton.addEventListener('click', closeGoalsModal);
    saveGoalsButton.addEventListener('click', saveMainGoals);

    // Function to handle promotion of tasks to main goals (inside scope)
    function handleTaskPromotion() {
        if (!tempPromotionData) return;
        
        const { taskText, dateString } = tempPromotionData;
        
        // Get date in readable format
        const [year, month, day] = dateString.split('-');
        const dateObj = new Date(year, month - 1, day);
        const formattedDate = dateObj.toLocaleDateString('en-US', { 
            month: 'short', day: 'numeric'
        });
        
        // Find the event that contains this task
        let eventText = "";
        if (notes[dateString]) {
            for (const event of notes[dateString]) {
                if (event.checklist) {
                    for (const item of event.checklist) {
                        if (item.task === taskText) {
                            eventText = event.text || "(No description)";
                            break;
                        }
                    }
                    if (eventText) break;
                }
            }
        }
        
        // Create goal text with date and event reference
        const goalText = eventText 
            ? `${taskText} (from "${eventText}" on ${formattedDate})`
            : `${taskText} (from ${formattedDate})`;
        
        // Add to main goals (limit to 3)
        if (mainGoals.length >= 3) {
            if (confirm("You already have 3 main goals. Replace the last one with this task?")) {
                mainGoals[2] = goalText;
            } else {
                tempPromotionData = null;
                return; // User cancelled
            }
        } else {
            mainGoals.push(goalText);
        }
        
        // Save goals to localStorage
        localStorage.setItem('mainGoals', JSON.stringify(mainGoals));
        
        // If logged in, also save to Firebase
        if (firebase.auth().currentUser) {
            db.collection('userNotes').doc(firebase.auth().currentUser.uid).update({
                mainGoals: mainGoals
            }).then(() => {
                console.log('Main goals saved to Firebase');
            }).catch(error => {
                console.error('Error saving main goals:', error);
            });
        }
        
        // Update goals display
        renderMainGoals();
        
        // Show visual success indicator (instead of alert)
        showPromotionSuccess(taskText);
        
        // Clear the temporary data
        tempPromotionData = null;
    }
    
    // Function to show promotion success without using alert
    function showPromotionSuccess(taskText) {
        // Create a toast notification element
        const toast = document.createElement('div');
        toast.className = 'promotion-toast';
        toast.innerHTML = `
            <div class="toast-message">
                <div class="toast-title">Added to Main Goals</div>
                <div class="toast-text">"${taskText}"</div>
            </div>
        `;
        document.body.appendChild(toast);
        
        // Animate in
        setTimeout(() => {
            toast.classList.add('show');
        }, 10);
        
        // Remove after 3 seconds
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => {
                document.body.removeChild(toast);
            }, 300); // Wait for fade out animation
        }, 3000);
    }
    
    // Listen for promote task events
    document.addEventListener('promoteTask', handleTaskPromotion);

    // Add resize listener
    window.addEventListener('resize', renderCalendarView);

    // Add event listener for Today button
    document.getElementById('today-button').addEventListener('click', () => {
        console.log('[CALENDAR] Today button clicked');
        
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        // Reset all calendar views to current date
        desktopMonthDate = new Date(today.getFullYear(), today.getMonth(), 1);
        desktopMonthDate.setHours(0, 0, 0, 0);
        
        mobileMonthDate = new Date(today.getFullYear(), today.getMonth(), 1);
        mobileMonthDate.setHours(0, 0, 0, 0);
        
        // Set mobile week view to start on the Sunday before the current date
        const dayOfWeek = today.getDay();
        mobileWeekStartDate = new Date(today);
        mobileWeekStartDate.setDate(today.getDate() - dayOfWeek);
        mobileWeekStartDate.setHours(0, 0, 0, 0);
        
        // Force refresh with today highlighted
        window.forceCalendarReset = true;
        renderCalendarView();
        
        console.log('[CALENDAR] Calendar reset to today');
    });

    // Initial Render
    renderCalendarView();
});

// Function that stores promotion data and is called by the star buttons
function promoteTaskToMainGoal(taskText, dateString) {
    tempPromotionData = { taskText, dateString };
    
    // Create a custom event to trigger the internal promotion function
    const event = new CustomEvent('promoteTask');
    document.dispatchEvent(event);
} 