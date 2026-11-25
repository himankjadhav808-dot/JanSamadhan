import { createContext, useContext, useState } from 'react';

const translations = {
  en: {
    // ── Settings page ──────────────────────────────────────────────────────
    settings:                   'Account Settings',
    profile:                    'Profile Information',
    preferences:                'Preferences',
    language:                   'Language',
    security:                   'Security',
    dangerZone:                 'Danger Zone',
    deleteAccount:              'Delete Account',
    confirmDelete:              'Type "DELETE" to confirm:',
    currentPassword:            'Current Password',
    newPassword:                'New Password',
    confirmPassword:            'Confirm New Password',
    saveChanges:                'Save Changes',
    changePassword:             'Change Password',
    fullName:                   'Full Name',
    email:                      'Email',
    avatar:                     'Profile Picture',
    languageLabel:              'Display Language',
    // Settings placeholders
    placeholderFullName:        'Your full name',
    placeholderCurrentPassword: 'Your current password',
    placeholderNewPassword:     'At least 8 characters',
    placeholderConfirmPassword: 'Repeat new password',

    // ── Navigation & Header ────────────────────────────────────────────────
    feed:                       'Feed',
    myProfile:                  'My Profile',
    globalDashboard:            'Global Dashboard',
    dashboard:                  'Dashboard',
    logout:                     'Log out',
    reportIssue:                'Report Issue',
    navigation:                 'Navigation',
    signIn:                     'Sign in',
    signInToUpvote:             'to upvote issues in your neighborhood.',

    // ── Community feed / Dashboard ─────────────────────────────────────────
    communityFeed:              'Community feed',
    showingIssuesNearby:        'Showing issues near your current location',
    locationUnavailable:        'Location unavailable — showing the default city area',
    requestingLocation:         'Requesting your location…',
    loadingIssues:              'Loading nearby issues…',
    noIssuesNearby:             'No issues found nearby',
    noIssuesSubtext:            'Reports within {km} km will appear here.',
    hideMap:                    'Hide map',
    showMap:                    'Show map',
    voteFailed:                 'Vote failed. Please try again.',
    couldNotLoadIssues:         'Could not load nearby issues',
    searchPlaceholder:          'Search by Issue ID, #JS-XXXX, or keyword…',
    searchResults:              'Search results for "{q}"',
    noSearchResults:            'No issues found for "{q}"',
    clearSearch:                'Clear search',
    searching:                  'Searching…',
    couldNotSearch:             'Search failed. Please try again.',

    // ── Report Issue page ──────────────────────────────────────────────────
    reportHeader:               'Report an Issue',
    reportSubheader:            'Help improve your community by reporting local problems',
    beforePhoto:                'Before Photo *',
    uploadPhoto:                'Click to upload photo',
    uploadPhotoHint:            'PNG, JPG up to 10MB',
    titleLabel:                 'Title *',
    titlePlaceholder:           'Brief description of the issue',
    deptLabel:                  'Department Category *',
    selectDept:                 'Select a department',
    descLabel:                  'Description *',
    descPlaceholder:            'Provide detailed information about the issue…',
    locationLabel:              'Location',
    detectLocation:             'Detect Location',
    detecting:                  'Detecting…',
    submitIssueBtn:             'Submit Issue',
    submitting:                 'Submitting…',
    locationRequired:           'Location access required',
    locationRequiredBody:       'GPS location is strictly required to report live issues. Please enable location access in your browser settings and click "Detect Location" again.',
    imageTooLarge:              'Image size must be less than 10MB',
    fillAllFields:              'Please fill in all required fields',
    submitFailed:               'Failed to submit issue. Please try again.',
    coordinates:                'Coordinates',
    accuracy:                   'accuracy',
    // Department display labels (value stays English for backend validation)
    dept_Roads:                 'Roads',
    dept_Streetlights:          'Streetlights',
    dept_Sanitation:            'Sanitation',
    dept_Water:                 'Water',
    dept_Parks:                 'Parks',
    dept_Traffic:               'Traffic',
    dept_Other:                 'Other',

    // ── IssueCard ──────────────────────────────────────────────────────────
    statusLive:                 'Live',
    statusPending:              'Pending validation',
    statusSolved:               'Solved',
    labelBefore:                'Before',
    labelAfter:                 'After',
    labelProposedFix:           'Proposed Fix',
    signInToVote:               'Sign in to vote',
    validateThisFix:            'Validate this fix:',
    approve:                    'Approve',
    reject:                     'Reject',
    justNow:                    'just now',

    // ── Citizen Analytics Dashboard ────────────────────────────────────────
    dashTitle:                  'Citizen Analytics Dashboard',
    dashSubheader:              'Real-time overview of your reported issues and community impact.',
    totalReported:              'Total Issues Reported',
    pendingIssues:              'Pending Review',
    inProgressIssues:           'In Progress',
    resolvedIssues:             'Resolved / Solved',
    civicPoints:                'Civic Points Earned',
    recentActivity:             'Recent Activity & Status Tracker',
    noIssuesYet:                "You haven't reported any issues yet.",

    // ── User Profile page ──────────────────────────────────────────────────
    citizenRole:                'Citizen',
    publicProfileNotice:        'This is your public profile',
    totalPoints:                'Total Points',
    issuesRaised:               'Issues Raised',
    problemsSolved:             'Problems Solved',
    reportedIssues:             'Reported Issues',
    loadingProfile:             'Loading profile…',
    issueReportedCount:         'issue(s) reported',
    noIssuesReported:           'No issues reported yet.',
    noIssuesOwnCitizen:         'Start contributing to your community by reporting issues.',
    noIssuesOwnAuthority:       'Check your dashboard to assign and resolve community issues.',
    noIssuesOtherCitizen:       "This user hasn't reported any issues yet.",
    noIssuesOtherAuthority:     "This authority hasn't resolved any issues yet.",
  },

  hi: {
    // ── Settings page ──────────────────────────────────────────────────────
    settings:                   'खाता सेटिंग्स',
    profile:                    'प्रोफ़ाइल जानकारी',
    preferences:                'प्राथमिकताएं',
    language:                   'भाषा',
    security:                   'सुरक्षा',
    dangerZone:                 'खतरा क्षेत्र',
    deleteAccount:              'खाता हटाएं',
    confirmDelete:              'पुष्टि के लिए "DELETE" टाइप करें:',
    currentPassword:            'वर्तमान पासवर्ड',
    newPassword:                'नया पासवर्ड',
    confirmPassword:            'नया पासवर्ड दोहराएं',
    saveChanges:                'बदलाव सहेजें',
    changePassword:             'पासवर्ड बदलें',
    fullName:                   'पूरा नाम',
    email:                      'ईमेल',
    avatar:                     'प्रोफ़ाइल चित्र',
    languageLabel:              'प्रदर्शन भाषा',
    // Settings placeholders
    placeholderFullName:        'आपका पूरा नाम',
    placeholderCurrentPassword: 'आपका वर्तमान पासवर्ड',
    placeholderNewPassword:     'कम से कम 8 अक्षर',
    placeholderConfirmPassword: 'नया पासवर्ड दोबारा दर्ज करें',

    // ── Navigation & Header ────────────────────────────────────────────────
    feed:                       'फ़ीड',
    myProfile:                  'मेरी प्रोफ़ाइल',
    globalDashboard:            'वैश्विक डैशबोर्ड',
    dashboard:                  'डैशबोर्ड',
    logout:                     'लॉग आउट',
    reportIssue:                'समस्या दर्ज करें',
    navigation:                 'नेविगेशन',
    signIn:                     'साइन इन करें',
    signInToUpvote:             'अपने आस-पास की समस्याओं को वोट देने के लिए।',

    // ── Community feed / Dashboard ─────────────────────────────────────────
    communityFeed:              'सामुदायिक फ़ीड',
    showingIssuesNearby:        'आपके वर्तमान स्थान के पास की समस्याएं दिख रही हैं',
    locationUnavailable:        'स्थान उपलब्ध नहीं — डिफ़ॉल्ट शहर क्षेत्र दिखाया जा रहा है',
    requestingLocation:         'आपका स्थान प्राप्त किया जा रहा है…',
    loadingIssues:              'पास की समस्याएं लोड हो रही हैं…',
    noIssuesNearby:             'पास में कोई समस्या नहीं मिली',
    noIssuesSubtext:            '{km} किमी के भीतर की रिपोर्ट यहां दिखाई देंगी।',
    hideMap:                    'मानचित्र छुपाएं',
    showMap:                    'मानचित्र दिखाएं',
    voteFailed:                 'वोट विफल हुआ। कृपया पुनः प्रयास करें।',
    couldNotLoadIssues:         'पास की समस्याएं लोड नहीं हो सकीं',
    searchPlaceholder:          'Issue ID, #JS-XXXX, या कीवर्ड से खोजें…',
    searchResults:              '"{q}" के लिए परिणाम',
    noSearchResults:            '"{q}" के लिए कोई समस्या नहीं मिली',
    clearSearch:                'खोज साफ़ करें',
    searching:                  'खोजा जा रहा है…',
    couldNotSearch:             'खोज विफल हुई। कृपया पुनः प्रयास करें।',

    // ── Report Issue page ──────────────────────────────────────────────────
    reportHeader:               'समस्या दर्ज करें',
    reportSubheader:            'स्थानीय समस्याओं की रिपोर्ट करके अपने समुदाय को बेहतर बनाने में मदद करें',
    beforePhoto:                'पहले की फोटो *',
    uploadPhoto:                'फोटो अपलोड करने के लिए क्लिक करें',
    uploadPhotoHint:            'PNG, JPG — 10MB तक',
    titleLabel:                 'शीर्षक *',
    titlePlaceholder:           'समस्या का संक्षिप्त विवरण',
    deptLabel:                  'विभाग की श्रेणी *',
    selectDept:                 'विभाग चुनें',
    descLabel:                  'विवरण *',
    descPlaceholder:            'समस्या के बारे में विस्तृत जानकारी प्रदान करें…',
    locationLabel:              'स्थान',
    detectLocation:             'स्थान का पता लगाएं',
    detecting:                  'पता लगाया जा रहा है…',
    submitIssueBtn:             'समस्या जमा करें',
    submitting:                 'जमा हो रहा है…',
    locationRequired:           'स्थान की अनुमति आवश्यक है',
    locationRequiredBody:       'लाइव समस्याएं दर्ज करने के लिए GPS स्थान अनिवार्य है। कृपया अपनी ब्राउज़र सेटिंग में स्थान की अनुमति सक्षम करें और "स्थान का पता लगाएं" पर क्लिक करें।',
    imageTooLarge:              'छवि का आकार 10MB से कम होना चाहिए',
    fillAllFields:              'कृपया सभी आवश्यक फ़ील्ड भरें',
    submitFailed:               'समस्या जमा करने में विफल। कृपया पुनः प्रयास करें।',
    coordinates:                'निर्देशांक',
    accuracy:                   'सटीकता',
    // Department display labels (value stays English for backend validation)
    dept_Roads:                 'सड़कें',
    dept_Streetlights:          'स्ट्रीटलाइट',
    dept_Sanitation:            'स्वच्छता',
    dept_Water:                 'जल आपूर्ति',
    dept_Parks:                 'पार्क',
    dept_Traffic:               'यातायात',
    dept_Other:                 'अन्य',

    // ── IssueCard ──────────────────────────────────────────────────────────
    statusLive:                 'लाइव',
    statusPending:              'सत्यापन लंबित',
    statusSolved:               'हल हो गया',
    labelBefore:                'पहले',
    labelAfter:                 'बाद में',
    labelProposedFix:           'प्रस्तावित समाधान',
    signInToVote:               'वोट देने के लिए साइन इन करें',
    validateThisFix:            'इस समाधान को सत्यापित करें:',
    approve:                    'स्वीकार करें',
    reject:                     'अस्वीकार करें',
    justNow:                    'अभी-अभी',

    // ── Citizen Analytics Dashboard ────────────────────────────────────────
    dashTitle:                  'नागरिक विश्लेषिकी डैशबोर्ड',
    dashSubheader:              'आपकी रिपोर्ट की गई समस्याओं और सामुदायिक प्रभाव का वास्तविक समय अवलोकन।',
    totalReported:              'कुल रिपोर्ट की गई समस्याएं',
    pendingIssues:              'समीक्षा लंबित',
    inProgressIssues:           'प्रगति पर है',
    resolvedIssues:             'हल किया गया',
    civicPoints:                'अर्जित नागरिक अंक',
    recentActivity:             'हाल की गतिविधि और स्थिति ट्रैकर',
    noIssuesYet:                'आपने अभी तक कोई समस्या दर्ज नहीं की है।',

    // ── User Profile page ──────────────────────────────────────────────────
    citizenRole:                'नागरिक',
    publicProfileNotice:        'यह आपकी सार्वजनिक प्रोफ़ाइल है',
    totalPoints:                'कुल अंक',
    issuesRaised:               'उठाई गई समस्याएं',
    problemsSolved:             'हल की गई समस्याएं',
    reportedIssues:             'रिपोर्ट की गई समस्याएं',
    loadingProfile:             'प्रोफ़ाइल लोड हो रही है…',
    issueReportedCount:         'समस्याएँ दर्ज की गई',
    noIssuesReported:           'अभी तक कोई समस्या दर्ज नहीं की गई है।',
    noIssuesOwnCitizen:         'समस्याएं दर्ज करके अपने समुदाय में योगदान दें।',
    noIssuesOwnAuthority:       'समस्याएं असाइन और हल करने के लिए अपना डैशबोर्ड देखें।',
    noIssuesOtherCitizen:       'इस उपयोगकर्ता ने अभी तक कोई समस्या दर्ज नहीं की है।',
    noIssuesOtherAuthority:     'इस अधिकारी ने अभी तक कोई समस्या हल नहीं की है।',
  },
};

const LanguageContext = createContext(null);

export function LanguageProvider({ children }) {
  const [lang, setLang] = useState(
    () => localStorage.getItem('janSamadhan_lang') || 'en'
  );

  const changeLanguage = (newLang) => {
    setLang(newLang);
    localStorage.setItem('janSamadhan_lang', newLang);
  };

  return (
    <LanguageContext.Provider value={{ lang, changeLanguage, t: translations[lang] }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error('useLanguage must be used within LanguageProvider');
  return ctx;
}
