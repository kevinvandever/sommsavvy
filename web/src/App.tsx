import { useEffect } from 'react';
import { Route, Switch, Redirect } from 'wouter';
import { auth } from '@mindstudio-ai/interface';
import { FilmGrain } from './components/FilmGrain';
import { Welcome } from './components/Welcome';
import { Home } from './routes/Home';
import { Result } from './routes/Result';
import { Cellar } from './routes/Cellar';
import { EntryDetail } from './routes/EntryDetail';
import { Profile } from './routes/Profile';
import { useStore } from './store';
import { api } from './api';

// Wires routing, auth state, theme, and one-time data load on boot.
export default function App() {
  const setUser = useStore((s) => s.setUser);
  const setCellar = useStore((s) => s.setCellar);
  const theme = useStore((s) => s.theme);
  const hasSeenWelcome = useStore((s) => s.hasSeenWelcome);
  const depth = useStore((s) => s.depth);
  const setDepth = useStore((s) => s.setDepth);

  // Apply theme to <html> for global token swap.
  useEffect(() => {
    document.documentElement.dataset.theme = theme === 'day' ? 'day' : 'midnight';
  }, [theme]);

  const setBooted = useStore((s) => s.setBooted);

  // Subscribe to auth state, then re-fetch user + cellar when it changes.
  // Set `booted` to true after the first response so route components know
  // the auth state has settled.
  useEffect(() => {
    let cancelled = false;
    const unsubscribe = auth.onAuthStateChanged(async () => {
      try {
        const { user, cellarCount, recentEntries } = await api.getMe();
        if (cancelled) return;
        setUser(user, cellarCount);
        if (user) {
          // Pull full cellar in one call.
          try {
            const { entries } = await api.listCellar();
            if (!cancelled) setCellar(entries);
          } catch (err) {
            console.error('Cellar load failed', err);
            // Fallback to the recent entries that came with getMe.
            if (!cancelled) setCellar(recentEntries);
          }

          // Apply the user's saved depth preference if set.
          if (user.depthPreference && user.depthPreference !== depth) {
            setDepth(user.depthPreference);
          }

          // Cold-start mitigation: if the user seeded their taste while
          // anonymous (on welcome), apply the stashed seed now and clear
          // the key. We only apply if the user doesn't already have a
          // seed — otherwise we'd silently overwrite something they
          // edited from their profile on another device.
          try {
            const pending = localStorage.getItem('somm-taste-seed-pending');
            if (pending && !user.tasteSeed) {
              const { user: updated } = await api.updateProfile({ tasteSeed: pending });
              if (!cancelled) setUser(updated, cellarCount);
              localStorage.removeItem('somm-taste-seed-pending');
            } else if (pending && user.tasteSeed) {
              // Already has a seed — drop the pending one rather than
              // overwriting the user's existing words.
              localStorage.removeItem('somm-taste-seed-pending');
            }
          } catch (err) {
            console.error('Pending taste seed apply failed:', err);
          }
        } else {
          setCellar([]);
        }
      } catch (err) {
        console.error('getMe failed', err);
      } finally {
        if (!cancelled) setBooted(true);
      }
    });
    return () => {
      cancelled = true;
      unsubscribe();
    };
    // We only want this on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <>
      <FilmGrain />
      <Switch>
        <Route path="/welcome" component={Welcome} />
        <Route path="/" component={hasSeenWelcome ? Home : WelcomeOrHome} />
        <Route path="/result" component={Result} />
        <Route path="/cellar" component={Cellar} />
        <Route path="/cellar/:id" component={EntryDetail} />
        <Route path="/profile" component={Profile} />
        <Route>
          <Redirect to="/" />
        </Route>
      </Switch>
    </>
  );
}

function WelcomeOrHome() {
  const hasSeenWelcome = useStore((s) => s.hasSeenWelcome);
  return hasSeenWelcome ? <Home /> : <Welcome />;
}
