import { useState } from 'react';
import { AbsoluteCommandGame } from './components/AbsoluteCommandGame';
import { EndlessJourneyGame } from './components/EndlessJourneyGame';
import { KakuroRotateGame } from './components/KakuroRotateGame';
import { MiniGameHost } from './components/MiniGames';
import { NumberLinkGame } from './components/NumberLinkGame';
import { PortalView } from './components/PortalView';
import { GameId } from './data/gamesCatalog';

export default function App() {
  const [activeGame, setActiveGame] = useState<GameId | null>(null);

  if (activeGame === 'menh-lenh-tuyet-doi') {
    return (
      <AbsoluteCommandGame onExitToPortal={() => setActiveGame(null)} />
    );
  }

  if (activeGame === 'hanh-trinh-vo-dinh') {
    return (
      <EndlessJourneyGame onExitToPortal={() => setActiveGame(null)} />
    );
  }

  if (activeGame === 'kakuro-xoay-chuyen') {
    return (
      <KakuroRotateGame onExitToPortal={() => setActiveGame(null)} />
    );
  }

  if (activeGame === 'so-lien-tranh-ba') {
    return <NumberLinkGame onExitToPortal={() => setActiveGame(null)} />;
  }

  if (activeGame !== null) {
    return (
      <MiniGameHost
        gameId={activeGame}
        onExit={() => setActiveGame(null)}
      />
    );
  }

  return <PortalView onLaunchGame={(id) => setActiveGame(id)} />;
}
