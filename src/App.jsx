import React, { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';

// ★ 실제 배포한 Render 백엔드 주소로 반드시 변경하세요!
const SERVER_URL = 'http://localhost:4000'; 
const socket = io(SERVER_URL, {
  autoConnect: false 
});

export default function App() {
  const [gameState, setGameState] = useState(null);
  const [roomId, setRoomId] = useState('');
  const [playerName, setPlayerName] = useState('');
  const logsEndRef = useRef(null);

  useEffect(() => {
    socket.connect();

    const handleUpdateRoom = (data) => setGameState(data);
    const handleRoomClosed = (msg) => {
      alert(msg);
      setGameState(null);
    };

    socket.on('update_room', handleUpdateRoom);
    socket.on('room_closed', handleRoomClosed);

    return () => {
      socket.off('update_room', handleUpdateRoom);
      socket.off('room_closed', handleRoomClosed);
      socket.disconnect();
    };
  }, []);

  useEffect(() => {
    if (logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [gameState?.logs]);

  const joinRoom = () => {
    if (!socket.connected) {
      alert("서버 연결 중입니다(Render 부팅 최대 50초). 잠시 후 시도해주세요.");
      socket.connect();
      return;
    }
    if (roomId && playerName) {
      socket.emit('join_room', { roomId, playerName });
    }
  };

  const emitAction = (action) => {
    if (!socket.connected) return alert("서버 연결이 끊겼습니다.");
    socket.emit('player_action', { roomId: gameState.roomId, action });
  };

  if (!gameState) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4">
        <h1 className="text-4xl font-bold text-green-400">Live Blackjack</h1>
        <input 
          className="px-4 py-2 text-black rounded outline-none" 
          placeholder="방 번호" 
          value={roomId} 
          onChange={(e) => setRoomId(e.target.value)} 
        />
        <input 
          className="px-4 py-2 text-black rounded outline-none" 
          placeholder="닉네임" 
          value={playerName} 
          onChange={(e) => setPlayerName(e.target.value)} 
        />
        <button 
          className="px-6 py-2 font-bold text-white bg-blue-600 rounded hover:bg-blue-700"
          onClick={joinRoom}
        >
          입장하기
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col max-w-4xl p-4 mx-auto min-h-screen">
      <header className="flex justify-between items-center mb-8 border-b border-gray-700 pb-4">
        <div>
          <h2 className="text-2xl font-bold">Room: {gameState?.roomId}</h2>
          <p className="text-sm text-gray-400">남은 카드: {gameState?.remainingCards}장</p>
        </div>
        <span className="px-3 py-1 bg-gray-800 rounded">Status: {gameState?.status}</span>
      </header>

      <main className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-8">
          {/* 플레이어 목록 */}
          <div className="space-y-4">
            {gameState?.players?.map((player, idx) => {
              const isMyTurn = gameState.turnIndex === idx;
              return (
                <div key={player.id} className={`p-4 rounded-xl border ${player.id === socket.id ? 'border-green-500 bg-green-900/20' : 'border-gray-700 bg-slate-800'} ${isMyTurn ? 'ring-2 ring-yellow-400' : ''}`}>
                  <div className="flex justify-between items-center mb-2">
                    <h3 className="font-semibold">{player.name} {player.id === socket.id && '(나)'}</h3>
                    <div className="space-x-2">
                      {isMyTurn && <span className="text-xs px-2 py-1 bg-yellow-600 text-white animate-pulse rounded">턴 진행 중</span>}
                      <span className="text-sm px-2 py-1 bg-slate-700 rounded uppercase">{player.state}</span>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2 mb-2 min-h-[4rem]">
                    {player.hand?.map((card, cIdx) => (
                      <div key={cIdx} className="w-12 h-16 bg-white text-black flex items-center justify-center rounded shadow font-bold border border-gray-300">
                        <span className={['♥', '♦'].includes(card[0]) ? 'text-red-600' : 'text-black'}>{card}</span>
                      </div>
                    ))}
                  </div>
                  <p className="text-sm font-bold">Score: {player.score}</p>
                </div>
              );
            })}
          </div>

          {/* 액션 버튼 */}
          {gameState?.status === 'playing' && gameState.players[gameState.turnIndex]?.id === socket.id && (
            <div className="flex gap-4">
              <button onClick={() => emitAction('hit')} className="flex-1 py-3 bg-green-600 font-bold rounded hover:bg-green-700 shadow">HIT (카드 받기)</button>
              <button onClick={() => emitAction('stand')} className="flex-1 py-3 bg-red-600 font-bold rounded hover:bg-red-700 shadow">STAND (멈추기)</button>
            </div>
          )}
        </div>

        {/* 로그 창 */}
        <div className="md:col-span-1 bg-black/50 border border-gray-700 rounded-xl flex flex-col h-[500px]">
          <div className="p-3 border-b border-gray-700 font-semibold text-gray-300">Game Logs</div>
          <div className="flex-1 p-3 overflow-y-auto text-sm space-y-2 font-mono">
            {gameState?.logs?.map((log, idx) => (
              <div key={idx} className={log.includes('BUST') ? 'text-red-400 font-bold' : 'text-gray-400'}>
                {log}
              </div>
            ))}
            <div ref={logsEndRef} />
          </div>
        </div>
      </main>
    </div>
  );
}
