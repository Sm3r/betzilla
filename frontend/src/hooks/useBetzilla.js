import { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import BetZillaArtifact from '../abi/BetZilla.json';
const BetZillaABI = BetZillaArtifact.abi;

// Contract address from latest deployment
const CONTRACT_ADDRESS = '0x3Aa5ebB10DC797CAC828524e59A333d0A371443c';

export const useBetzilla = () => {
  const [contract, setContract] = useState(null);
  const [signer, setSigner] = useState(null);
  const [account, setAccount] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isInitialized, setIsInitialized] = useState(false);

  // Check if wallet is already connected
  const checkWalletConnection = async () => {
    try {
      if (!window.ethereum) {
        return false;
      }

      const accounts = await window.ethereum.request({
        method: 'eth_accounts',
      });

      if (accounts.length > 0) {
        // Usa direttamente window.ethereum senza "any"
        const provider = new ethers.BrowserProvider(window.ethereum);
        const network = await provider.getNetwork();
        console.log('Connected network:', network.chainId);
        const signer = await provider.getSigner();
        
        setAccount(accounts[0]);
        setSigner(signer);

        // Create contract instance
        const contractInstance = new ethers.Contract(
          CONTRACT_ADDRESS,
          BetZillaABI,
          signer
        );
        setContract(contractInstance);
        return true;
      }
      return false;
    } catch (err) {
      console.error('Error checking wallet connection:', err);
      return false;
    }
  };

  // Connect to MetaMask
  const connectWallet = async () => {
    try {
      setLoading(true);
      setError(null);

      if (!window.ethereum) {
        throw new Error('MetaMask not installed');
      }

      // Request account access
      const accounts = await window.ethereum.request({
        method: 'eth_requestAccounts',
      });

      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      
      setAccount(accounts[0]);
      setSigner(signer);

      // Create contract instance
      const contractInstance = new ethers.Contract(
        CONTRACT_ADDRESS,
        BetZillaABI,
        signer
      );
      setContract(contractInstance);

      return accounts[0];
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  // Initialize wallet connection on app start
  useEffect(() => {
    const initializeWallet = async () => {
      if (!isInitialized) {
        await checkWalletConnection();
        setIsInitialized(true);
      }
    };

    initializeWallet();
  }, [isInitialized]);

  // Listen for account changes
  useEffect(() => {
    if (window.ethereum) {
      const handleAccountsChanged = (accounts) => {
        if (accounts.length > 0) {
          setAccount(accounts[0]);
          // Recreate contract instance with new signer
          const provider = new ethers.BrowserProvider(window.ethereum);
          provider.getSigner().then(signer => {
            setSigner(signer);
            const contractInstance = new ethers.Contract(
              CONTRACT_ADDRESS,
              BetZillaABI,
              signer
            );
            setContract(contractInstance);
          });
        } else {
          setAccount(null);
          setContract(null);
          setSigner(null);
        }
      };

      window.ethereum.on('accountsChanged', handleAccountsChanged);

      return () => {
        window.ethereum.removeListener('accountsChanged', handleAccountsChanged);
      };
    }
  }, []);

  // Place a bet
  const placeBet = async (marketId, outcome, amount) => {
    if (!contract || !signer) {
      throw new Error('Wallet not connected');
    }

    try {
      setLoading(true);
      setError(null);

      console.log(`🎯 Placing bet: Market ${marketId}, Outcome ${outcome}, Amount ${amount} ETH`);

      const tx = await contract.placeBet(marketId, outcome, {
        value: ethers.parseEther(amount.toString())
      });

      console.log(`📝 Transaction hash: ${tx.hash}`);
      const receipt = await tx.wait();
      console.log(`✅ Bet placed successfully! Block: ${receipt.blockNumber}`);
      
      return receipt;
    } catch (err) {
      console.error('❌ Error placing bet:', err);
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  // Get market info
  const getMarket = async (marketId) => {
    if (!contract) {
      throw new Error('Contract not connected');
    }

    try {
      const market = await contract.markets(marketId);
      return market;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  };

  // Get user bet
  const getUserBet = async (marketId) => {
    if (!contract || !account) {
      throw new Error('Wallet not connected');
    }

    try {
      const bet = await contract.bets(marketId, account);
      return bet;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  };

  // Get all user bets (check multiple markets)
  const getAllUserBets = async () => {
    if (!contract || !account) {
      throw new Error('Wallet not connected');
    }

    try {
      const userBets = [];
      const marketCount = Number(await contract.marketCount());
      for (let marketId = 1; marketId <= marketCount; marketId++) {
        try {
          const bet = await contract.bets(marketId, account);
          if (bet && bet.amount > 0) {
            const market = await contract.markets(marketId);
            userBets.push({
              marketId,
              bet,
              market
            });
          }
        } catch (error) {
          // skip
        }
      }
      return userBets;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  };

  // Claim winnings
  const claimWinnings = async (marketId) => {
    if (!contract || !signer) {
      throw new Error('Wallet not connected');
    }

    try {
      setLoading(true);
      setError(null);

      const tx = await contract.claimWinnings(marketId);
      const receipt = await tx.wait();
      return receipt;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  // Get match details from backend
  const getMatchDetails = async (marketId) => {
    try {
      const response = await fetch(`http://localhost:4000/api/matches`);
      const data = await response.json();
      
      if (data.success && data.matches) {
        // Find match by ID (marketId corresponds to match id)
        const match = data.matches.find(m => m.id === marketId);
        return match || null;
      }
      return null;
    } catch (error) {
      console.error('Error fetching match details:', error);
      return null;
    }
  };

  // Get estimated odds (live odds)
  const getEstimatedOdds = async (marketId) => {
    if (!contract) throw new Error('Contract not connected');
    try {
      return await contract.getEstimatedOdds(marketId);
    } catch (err) {
      setError(err.message);
      throw err;
    }
  };

  // Get current fee (2% or 3%)
  const getCurrentFee = async (marketId) => {
    if (!contract) throw new Error('Contract not connected');
    try {
      return await contract.getCurrentFee(marketId);
    } catch (err) {
      setError(err.message);
      throw err;
    }
  };

  return {
    contract,
    signer,
    account,
    loading,
    error,
    connectWallet,
    placeBet,
    getMarket,
    getUserBet,
    getAllUserBets,
    claimWinnings,
    getMatchDetails,
    getEstimatedOdds,
    getCurrentFee,
  };
};