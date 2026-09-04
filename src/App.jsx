import React, { useState, useEffect } from 'react';
import { io } from 'socket.io-client';

// ★ 요청하신 렌더 백엔드 주소 적용 완료
const SERVER_URL = 'https://blackjack-backend-lpff.onrender.com';
const socket = io(SERVER_URL, { autoConnect: false });

export default function App() {
  const [gameState, setGameState] = useState(null);
  const [roomId, setRoomId] = useState('');
  const [playerName, setPlayerName] = useState('');
  const [betAmount, setBetAmount] = useState(10); // 기본 베팅금 10으로 조정
  const [revealedCards, setRevealedCards] = useState(new Set());

  useEffect(() => {
    socket.connect();
    socket.on('update_room', (data) => {
      setGameState(data);
      if (data.status === 'betting') setRevealedCards(new Set());
    });
    socket.on('room_closed', (msg) => { alert(msg); setGameState(null); });
    return () => { socket.off('update_room'); socket.off('room_closed'); socket.disconnect(); };
  }, []);

  const joinRoom = () => {
    if (!socket.connected) return alert("서버에 연결 중입니다. 5초 뒤 다시 시도해주세요.");
    if (roomId && playerName) socket.emit('join_room', { roomId, playerName });
  };

  const emitAction = (action, amount = 0) => {
    socket.emit('player_action', { roomId: gameState.roomId, action, amount });
  };

  const renderCard = (card, idx, playerId) => {
    if (card === 'HIDDEN') {
      return (
        <div key={idx} className="w-16 h-24 bg-blue-800 border-2 border-white text-white flex items-center justify-center rounded shadow-lg font-bold text-xs">
          BJ
        </div>
      );
    }

    const isMine = playerId === socket.id;
    const cardId = `${playerId}-${idx}`;
    const isRevealed = !isMine || revealedCards.has(cardId);
    const isRed = ['♥', '♦'].includes(card[0]);

    return (
      <div 
        key={idx}
        className={`relative w-16 h-24 ${isMine && !isRevealed ? 'cursor-pointer hover:-translate-y-2' : ''} transition-transform duration-300`}
        style={{ perspective: '1000px' }}
        onClick={() => { if (isMine && !isRevealed) setRevealedCards(prev => new Set(prev).add(cardId)); }}
      >
        <div 
          className="w-full h-full transition-transform duration-700 shadow-xl rounded"
          style={{ transformStyle: 'preserve-3d', transform: isRevealed ? 'rotateY(0deg)' : 'rotateY(180deg)' }}
        >
          <div className="absolute w-full h-full bg-white flex items-center justify-center rounded border border-gray-300" style={{ backfaceVisibility: 'hidden' }}>
            <span className={`font-bold text-xl ${isRed ? 'text-red-600' : 'text-black'}`}>{card}</span>
          </div>
          <div className="absolute w-full h-full bg-blue-800 border-2 border-white flex items-center justify-center rounded" style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}>
            <span className="text-white text-[10px] font-bold animate-pulse">CLICK!</span>
          </div>
        </div>
      </div>
    );
  };

  if (!gameState) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4">
        <h1 className="text-4xl font-bold text-green-400">Live Casino Blackjack</h1>
        <input className="px-4 py-2 text-black rounded outline-none" placeholder="방 번호" value={roomId} onChange={e => setRoomId(e.target.value)} />
        <input className="px-4 py-2 text-black rounded outline-none" placeholder="닉네임" value={playerName} onChange={e => setPlayerName(e.target.value)} />
        <button className="px-6 py-2 font-bold text-white bg-blue-600 rounded hover:bg-blue-700" onClick={joinRoom}>입장하기</button>
      </div>
    );
  }

  const me = gameState.players.find(p => p.id === socket.id);
  const isMyTurn = gameState.status === 'playing' && gameState.players[gameState.turnIndex]?.id === socket.id;

  return (
    <div className="flex flex-col max-w-5xl p-4 mx-auto min-h-screen">
      <header className="flex justify-between items-center mb-6 border-b border-gray-700 pb-4">
        <div>
          <h2 className="text-2xl font-bold text-yellow-400">Room: {gameState.roomId}</h2>
          <p className="text-sm text-gray-300">잔여 카드: {gameState.remainingCards}장 | 내 칩: 🪙 {me?.chips || 0}</p>
        </div>
        <span className="px-4 py-2 bg-gray-800 rounded font-bold uppercase tracking-wider">{gameState.status}</span>
      </header>

      <main className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-6 flex flex-col">
          
          {/* 딜러 영역 */}
          <div className="p-6 bg-slate-800/80 rounded-xl border border-gray-600 flex flex-col items-center justify-center min-h-[160px]">
            <h3 className="text-lg font-semibold mb-3 text-red-400 tracking-widest uppercase">Dealer</h3>
            <div className="flex gap-2 justify-center mb-2">
              {gameState.dealer.hand.map((card, i) => renderCard(card, i, 'dealer'))}
            </div>
            {gameState.status !== 'betting' && <p className="text-sm font-bold text-white">Score: {gameState.dealer.score}</p>}
          </div>

          {/* 플레이어 목록 영역 */}
          <div className="flex-1 space-y-3 overflow-y-auto pr-2">
            {gameState.players.map((player, idx) => {
              const active = gameState.turnIndex === idx;
              const isMine = player.id === socket.id;
              const isBankrupt = player.state === 'bankrupt';
              const isAllRevealed = !isMine || player.hand.every((_, cIdx) => revealedCards.has(`${player.id}-${cIdx}`));

              return (
                <div key={player.id} className={`p-4 rounded-xl border flex justify-between items-center transition-all ${isMine ? 'border-green-500 bg-green-900/30' : 'border-gray-700 bg-slate-800'} ${active ? 'ring-2 ring-yellow-400 transform scale-[1.02]' : ''} ${isBankrupt ? 'opacity-50 grayscale' : ''}`}>
                  <div className="flex flex-col gap-1 w-1/3">
                    <h3 className="font-semibold text-lg">{player.name} {isMine && '(나)'}</h3>
                    <span className="text-sm text-gray-300">🪙 {player.chips} {isBankrupt ? '(파산)' : `| 💰 Bet: ${player.bet}`}</span>
                    <span className={`text-xs px-2 py-1 rounded w-max uppercase ${isBankrupt ? 'bg-red-900 text-red-300' : 'bg-slate-900'}`}>{player.state}</span>
                    {player.result && <span className={`font-bold mt-1 ${player.result === 'WIN' || player.result === 'BLACKJACK' ? 'text-yellow-400' : player.result === 'LOSE' ? 'text-red-400' : 'text-gray-400'}`}>{player.result}</span>}
                  </div>
                  
                  <div className="flex gap-[-10px] justify-end flex-1 pl-4">
                    {player.hand.map((card, cIdx) => (
                      <div key={cIdx} className="-ml-4 relative z-[cIdx]">
                        {renderCard(card, cIdx, player.id)}
                      </div>
                    ))}
                  </div>
                  <div className="w-1/6 text-right font-bold text-xl ml-4">
                    {player.score > 0 && (isAllRevealed ? player.score : '???')}
                  </div>
                </div>
              );
            })}
          </div>

          {/* 하단 컨트롤 패널 */}
          <div className="bg-slate-800 p-4 rounded-xl border border-gray-700 min-h-[100px] flex items-center justify-center">
            {/* 파산자 화면 표시 */}
            {me?.state === 'bankrupt' && (
              <div className="text-center w-full">
                <p className="text-red-400 font-bold text-xl mb-2">💸 칩을 모두 잃어 관전 모드로 전환되었습니다.</p>
                <p className="text-gray-400">게임에 다시 참여하려면 새로고침하여 방에 재입장해주세요.</p>
              </div>
            )}

            {/* 베팅 페이즈 */}
            {gameState.status === 'betting' && me?.state === 'betting' && (
              <div className="flex gap-4 items-center w-full max-w-md">
                <input type="range" min="10" max={me.chips} step="10" value={betAmount} onChange={(e) => setBetAmount(Number(e.target.value))} className="flex-1" />
                <span className="font-bold w-20 text-right">{betAmount} 칩</span>
                <button onClick={() => emitAction('bet', betAmount)} className="px-6 py-2 bg-yellow-600 font-bold rounded hover:bg-yellow-500 text-black">베팅하기</button>
              </div>
            )}
            {gameState.status === 'betting' && me?.state === 'ready' && <p className="text-gray-400 animate-pulse">다른 플레이어의 베팅을 기다리는 중...</p>}

            {/* 플레이 페이즈 */}
            {isMyTurn && (
              <div className="flex gap-3 w-full">
                <button onClick={() => emitAction('hit')} className="flex-1 py-3 bg-green-600 font-bold rounded hover:bg-green-700 text-lg shadow-lg">HIT (받기)</button>
                <button onClick={() => emitAction('stand')} className="flex-1 py-3 bg-red-600 font-bold rounded hover:bg-red-700 text-lg shadow-lg">STAND (멈춤)</button>
                {me.hand.length === 2 && me.chips >= me.bet && (
                  <button onClick={() => emitAction('double')} className="flex-1 py-3 bg-blue-600 font-bold rounded hover:bg-blue-700 text-lg shadow-lg">DOUBLE (2배)</button>
                )}
              </div>
            )}
            {gameState.status === 'playing' && !isMyTurn && me?.state !== 'bankrupt' && <p className="text-gray-400">다른 플레이어의 턴을 기다리는 중...</p>}

            {/* 다음 라운드 준비 */}
            {gameState.status === 'finished' && me?.state !== 'ready_next' && me?.state !== 'bankrupt' && (
              <button onClick={() => emitAction('next_round')} className="w-full py-4 bg-purple-600 font-bold text-xl rounded hover:bg-purple-700 animate-bounce">다음 라운드 준비하기</button>
            )}
            {gameState.status === 'finished' && me?.state === 'ready_next' && <p className="text-gray-400 animate-pulse">다른 플레이어의 준비를 기다리는 중...</p>}
          </div>
        </div>

        {/* 로그 창 */}
        <div className="md:col-span-1 bg-black/60 border border-gray-700 rounded-xl flex flex-col h-[700px]">
          <div className="p-3 border-b border-gray-700 font-semibold text-gray-300">카지노 로그</div>
          <div className="flex-1 p-3 overflow-y-auto text-sm space-y-2 font-mono">
            {gameState.logs.map((log, idx) => (
              <div key={idx} className={log.includes('BUST') || log.includes('결과') || log.includes('파산') ? 'text-yellow-400 font-bold' : log.includes('시스템') || log.includes('SYSTEM') ? 'text-gray-500' : 'text-gray-300'}>
                {log}
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
