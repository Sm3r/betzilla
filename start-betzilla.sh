#!/bin/bash

echo "🎰 Starting BETZILLA - Decentralized Sports Betting Platform"
echo "=========================================================="

# Function to check if a port is in use
check_port() {
    local port=$1
    if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null 2>&1; then
        echo "⚠️  Port $port is already in use. Stopping existing processes..."
        pkill -f ":$port" 2>/dev/null
        sleep 2
    fi
}

# Function to wait for a service to be ready
wait_for_service() {
    local url=$1
    local service_name=$2
    local max_attempts=30
    local attempt=1
    
    echo "⏳ Waiting for $service_name to be ready..."
    while [ $attempt -le $max_attempts ]; do
        if curl -s "$url" >/dev/null 2>&1; then
            echo "✅ $service_name is ready!"
            return 0
        fi
        echo "   Attempt $attempt/$max_attempts..."
        sleep 2
        attempt=$((attempt + 1))
    done
    echo "❌ $service_name failed to start after $max_attempts attempts"
    return 1
}

# Stop any existing processes first
echo "🛑 Stopping existing processes..."
./stop-betzilla.sh >/dev/null 2>&1
sleep 3

# Check and clear ports
check_port 3000
check_port 4000
check_port 8545

# Start Hardhat node
echo "🔗 Starting Hardhat node..."
cd contracts
npx hardhat node > ../hardhat.log 2>&1 &
HARDHAT_PID=$!
echo "Hardhat node started with PID: $HARDHAT_PID"

# Wait for Hardhat to be ready
if ! wait_for_service "http://localhost:8545" "Hardhat node"; then
    echo "❌ Failed to start Hardhat node"
    exit 1
fi

# Deploy contract
echo "📦 Deploying BetZilla contract..."
echo "🚀 Deploying BetZilla contract..."
npx hardhat run scripts/deploy.js --network localhost >> ../hardhat.log 2>&1
if [ $? -eq 0 ]; then
    echo "✅ Contract deployed successfully!"
else
    echo "❌ Contract deployment failed"
    exit 1
fi

# Extract contract address from logs
CONTRACT_ADDRESS=$(grep "Contract address:" ../hardhat.log | tail -1 | awk '{print $NF}')
if [ -n "$CONTRACT_ADDRESS" ]; then
    echo "Contract address: $CONTRACT_ADDRESS"
else
    echo "❌ Could not extract contract address"
    exit 1
fi

cd ..

# Start backend
echo "🖥️ Starting backend..."
cd backend
npm start > ../backend.log 2>&1 &
BACKEND_PID=$!
echo "Backend started with PID: $BACKEND_PID"

# Wait for backend to be ready
if ! wait_for_service "http://localhost:4000/api/health" "Backend"; then
    echo "❌ Failed to start backend"
    exit 1
fi

cd ..

# Start frontend
echo "🌐 Starting frontend..."
cd frontend
npm start > ../frontend.log 2>&1 &
FRONTEND_PID=$!
echo "Frontend started with PID: $FRONTEND_PID"

# Wait for frontend to be ready
if ! wait_for_service "http://localhost:3000" "Frontend"; then
    echo "❌ Failed to start frontend"
    exit 1
fi

cd ..

echo ""
echo "🎉 BETZILLA is now running!"
echo "=========================="
echo "Frontend: http://localhost:3000"
echo "Backend:  http://localhost:4000"
echo "Hardhat:  http://localhost:8545"
echo ""
echo "📊 Process IDs:"
echo "Hardhat: $HARDHAT_PID"
echo "Backend: $BACKEND_PID"
echo "Frontend: $FRONTEND_PID"
echo ""
echo "📝 Logs:"
echo "Hardhat: hardhat.log"
echo "Backend: backend.log"
echo "Frontend: frontend.log"
echo ""
echo "🛑 To stop all services, run: ./stop-betzilla.sh"
echo ""
echo "🔍 Quick status check:"
echo "Frontend: $(curl -s http://localhost:3000 >/dev/null && echo '✅ Online' || echo '❌ Offline')"
echo "Backend:  $(curl -s http://localhost:4000/api/health >/dev/null && echo '✅ Online' || echo '❌ Offline')"
echo "Hardhat:  $(curl -s -X POST -H "Content-Type: application/json" --data '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}' http://localhost:8545 >/dev/null && echo '✅ Online' || echo '❌ Offline')" 