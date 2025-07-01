import React, { useState, useEffect } from 'react';
import './Bet.css';

const Bet = ({ 
  account, 
  contract, 
  placeBet, 
  getEstimatedOdds, 
  getCurrentFee,
  loading 
}) => {
  const [matches, setMatches] = useState([]);
  const [betAmount, setBetAmount] = useState('');
  const [selectedOutcome, setSelectedOutcome] = useState(1);
  const [liveOdds, setLiveOdds] = useState({});
  const [fee, setFee] = useState({});

  // Fetch matches from backend
  useEffect(() => {
    const fetchMatches = async () => {
      try {
        const response = await fetch('/api/markets');
        const data = await response.json();
        if (data.success) {
          setMatches(data.markets);
        }
      } catch (error) {
        console.error('Error fetching matches:', error);
      }
    };

    fetchMatches();
  }, []);

  // Load live odds and fees for each match
  useEffect(() => {
    const fetchLiveOddsAndFee = async () => {
      if (!contract) return;
      const oddsObj = {};
      const feeObj = {};
      for (const match of matches) {
        try {
          const odds = await getEstimatedOdds(match.id);
          oddsObj[match.id] = odds;
        } catch (e) {
          oddsObj[match.id] = null;
        }
        try {
          const f = await getCurrentFee(match.id);
          feeObj[match.id] = f;
        } catch (e) {
          feeObj[match.id] = null;
        }
      }
      setLiveOdds(oddsObj);
      setFee(feeObj);
    };
    fetchLiveOddsAndFee();
  }, [contract, matches, getEstimatedOdds, getCurrentFee]);

  const handlePlaceBet = async (marketId) => {
    if (!betAmount || betAmount <= 0) {
      alert('Please enter a valid bet amount');
      return;
    }

    // Validation outcome for market
    const match = matches.find(m => m.id === marketId);
    if (match) {
      const maxOutcome = match.odds.draw > 0 ? 3 : 2;
      if (selectedOutcome > maxOutcome) {
        alert(`Invalid outcome. For ${match.homeTeam} vs ${match.awayTeam}, valid outcomes are 1-${maxOutcome}`);
        return;
      }
    }

    try {
      await placeBet(marketId, selectedOutcome, betAmount);
      alert('Bet placed successfully!');
      setBetAmount('');
    } catch (error) {
      console.error('Smart contract error:', error);
      alert(`Error placing bet: ${error.message}`);
    }
  };

  if (!account) {
    return (
      <div className="bet-page">
        <div className="container">
          <div className="wallet-prompt">
            <div className="prompt-content">
              <h2>🔒 Wallet Connection Required</h2>
              <p>Please connect your MetaMask wallet to start betting on sports matches.</p>
              <div className="prompt-icon">🦊</div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bet-page">
      <div className="container">
        <div className="page-header">
          <h1>🎯 Available Matches</h1>
          <p>Place your blind bets before odds are revealed</p>
        </div>

        {matches.length === 0 ? (
          <div className="no-matches">
            <div className="empty-state">
              <div className="empty-icon">⚽</div>
              <h3>No matches available</h3>
              <p>Check back later for new betting opportunities!</p>
            </div>
          </div>
        ) : (
          <div className="matches-grid">
            {matches.map((match) => (
              <div key={match.id} className="match-card">
                <div className="match-header">
                  <div className="teams">
                    <h3>{match.homeTeam} vs {match.awayTeam}</h3>
                    <span className="league-badge">{match.league}</span>
                  </div>
                  <div className="match-info">
                    <span className="match-date">📅 {new Date(match.startTime).toLocaleDateString()}</span>
                  </div>
                </div>
                
                <div className="match-description">
                  <p>{match.description}</p>
                </div>
                
                <div className="odds-section">
                  <h4>Current Odds</h4>
                  <div className="odds-display">
                    <div className="odds-item">
                      <div className="odds-value">
                        {liveOdds[match.id] && liveOdds[match.id][0] > 0
                          ? (liveOdds[match.id][0] / 100).toFixed(2)
                          : '???'}
                      </div>
                      <div className="odds-label">{match.homeTeam}</div>
                    </div>
                    {match.odds.draw > 0 && (
                      <div className="odds-item">
                        <div className="odds-value">
                          {liveOdds[match.id] && liveOdds[match.id][1] > 0
                            ? (liveOdds[match.id][1] / 100).toFixed(2)
                            : '???'}
                        </div>
                        <div className="odds-label">Draw</div>
                      </div>
                    )}
                    <div className="odds-item">
                      <div className="odds-value">
                        {liveOdds[match.id] && (match.odds.draw > 0 ? liveOdds[match.id][2] : liveOdds[match.id][1]) > 0
                          ? ((match.odds.draw > 0 ? liveOdds[match.id][2] : liveOdds[match.id][1]) / 100).toFixed(2)
                          : '???'}
                      </div>
                      <div className="odds-label">{match.awayTeam}</div>
                    </div>
                  </div>
                  <div className="odds-info">
                    {liveOdds[match.id] && liveOdds[match.id][0] > 0
                      ? `💰 Live Odds Available! Fee: ${fee[match.id] || '?'}%`
                      : '🔒 Blind Betting - Odds revealed at match start'}
                  </div>
                </div>

                <div className="betting-section">
                  <div className="bet-controls">
                    <div className="outcome-selector">
                      <label>Choose Outcome:</label>
                      <select 
                        className="outcome-select"
                        value={selectedOutcome}
                        onChange={(e) => setSelectedOutcome(parseInt(e.target.value))}
                      >
                        <option value={1}>🏠 {match.homeTeam}</option>
                        {match.odds.draw > 0 && <option value={2}>🤝 Draw</option>}
                        <option value={match.odds.draw > 0 ? 3 : 2}>🚀 {match.awayTeam}</option>
                      </select>
                    </div>
                    
                    <div className="amount-input">
                      <label>Bet Amount (ETH):</label>
                      <input
                        type="number"
                        className="bet-amount-input"
                        placeholder="0.01"
                        value={betAmount}
                        onChange={(e) => setBetAmount(e.target.value)}
                        step="0.01"
                        min="0.001"
                      />
                    </div>
                  </div>
                  
                  <div className="blind-betting-info">
                    <div className="info-box">
                      <span className="info-icon">💡</span>
                      <span>Blind betting: Place your bet before odds are revealed for a fair experience!</span>
                    </div>
                  </div>
                  
                  <button 
                    className="place-bet-btn"
                    onClick={() => handlePlaceBet(match.id)}
                    disabled={loading || !betAmount || betAmount <= 0}
                  >
                    {loading ? (
                      <div className="btn-loading">
                        <span className="loading-spinner"></span>
                        Placing Bet...
                      </div>
                    ) : (
                      <>
                        <span className="btn-icon">🎯</span>
                        Place Bet
                      </>
                    )}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Bet;
