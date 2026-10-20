import fs from 'fs';

const filePath = 'src/App.tsx';
let content = fs.readFileSync(filePath, 'utf8');

const targetImport = "import { AthleteOnboardingModal } from './components/AthleteOnboardingModal';";
const replacementImport = `import { AthleteOnboardingModal } from './components/AthleteOnboardingModal';
import { auth } from './lib/firebase';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';`;

if (content.includes(targetImport)) {
  content = content.replace(targetImport, replacementImport);
}

const targetStateRegex = /const \[showOnboarding, setShowOnboarding\] = React\.useState<boolean>\(\(\) => \{[\s\S]*?\}\);/;
const replacementState = `const [currentUser, setCurrentUser] = React.useState<FirebaseUser | null>(() => auth.currentUser);
  const [showOnboarding, setShowOnboarding] = React.useState<boolean>(false);

  React.useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      if (user) {
        try {
          const userKey = 'sharkset_onboarding_completed_' + user.uid;
          const userLevelKey = 'sharkset_user_level_' + user.uid;
          const done = localStorage.getItem(userKey) === 'true' || Boolean(localStorage.getItem(userLevelKey));
          setShowOnboarding(!done);
        } catch {
          setShowOnboarding(!userProfile.level);
        }
      } else {
        setShowOnboarding(false);
      }
    });
    return () => unsub();
  }, [userProfile.level]);`;

if (targetStateRegex.test(content)) {
  content = content.replace(targetStateRegex, replacementState);
}

const targetHandlerRegex = /const handleCompleteOnboarding = \(level: typeof userProfile\.level\) => \{[\s\S]*?setShowOnboarding\(false\);\s*\};/;
const replacementHandler = `const handleCompleteOnboarding = (level: typeof userProfile.level) => {
    setUserProfile({ ...userProfile, level });
    try {
      if (currentUser) {
        localStorage.setItem('sharkset_onboarding_completed_' + currentUser.uid, 'true');
        if (level) localStorage.setItem('sharkset_user_level_' + currentUser.uid, level);
      }
      localStorage.setItem('sharkset_onboarding_completed', 'true');
    } catch {
      // ignore
    }
    setShowOnboarding(false);
  };`;

if (targetHandlerRegex.test(content)) {
  content = content.replace(targetHandlerRegex, replacementHandler);
}

fs.writeFileSync(filePath, content, 'utf8');
console.log('APP.TSX UPDATED SUCCESSFULLY');
