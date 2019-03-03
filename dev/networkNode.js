const express = require('express');
const uuid = require('uuid/v1');
const axios = require('axios');

const Blockchain = require('./blockchain');

const PORT = process.env.PORT || process.argv[2];
const nodeAddress = uuid().split('-').join('');
const app = express();
const blockchain = new Blockchain(nodeAddress);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get('/', function(req, res) {
    res.sendFile('./blockchain-frontend/index.html', { root: __dirname });
});

app.get('/blockchain', function(req, res) {
    res.send(blockchain);
});

app.post('/transaction', function(req, res) {
    const { newTransaction } = req.body;

    blockchain.addTransactionToPendingTransactions(newTransaction);
    
    res.json({ note: 'Transaction added successfully' });
});

app.post('/transaction/broadcast', function(req, res) {
    const { amount, sender, recipient } = req.body;
    const newTransaction = blockchain.createNewTransaction(amount, sender, recipient);

    blockchain.addTransactionToPendingTransactions(newTransaction);

    try {
        blockchain.networkNodes.forEach(async networkNodeUrl => {
            await axios.post(`${networkNodeUrl}/transaction`, { newTransaction });
        });

        res.json({ note: `Transaction added and broadcasted successfully.` });
    } catch (e) {
        res.json({ error: e.message });
    }
});

app.get('/mine', async function(req, res) {
    const lastBlock = blockchain.getLastBlock();
    const previousBlockHash = lastBlock.hash;
    const currentBlockData = {
        transactions: blockchain.pendingTransactions,
        index: lastBlock.index + 1
    };

    const nonce = blockchain.proofOfWork(previousBlockHash, currentBlockData);
    const newBlockHash = blockchain.hashBlock(previousBlockHash, currentBlockData, nonce);

    blockchain.createNewTransaction(12.5, '00', nodeAddress);

    const newBlock = blockchain.createNewBlock(nonce, previousBlockHash, newBlockHash);

    try {
        blockchain.networkNodes.forEach(async networkNodeUrl => {
            await axios.post(`${networkNodeUrl}/receive-new-block`, { newBlock });
        });

        await axios.post(`${blockchain.currentNodeUrl}/transaction/broadcast`, {
            amount: 12.5,
            sender: '00',
            recipient: nodeAddress
        });

        res.json({
            note: 'New block mined and broadcasted',
            block: newBlock
        });
    } catch (e) {
        res.json({ error: e.message });
    }
});

app.post('/receive-new-block', function(req, res) {
    const { newBlock } = req.body;
    const lastBlock = blockchain.getLastBlock();
    const validHash = newBlock.previousBlockHash === lastBlock.hash;
    const validIndex = lastBlock.index + 1 === newBlock.index;

    if(validHash && validIndex) {
        blockchain.chain.push(newBlock);
        blockchain.pendingTransactions = [];

        res.json({ note: 'New block received and accepted', block: newBlock });
    } else {
        res.json({ note: 'New block rejected', block: newBlock });
    }
});

app.post('/register-and-broadcast-node', async function(req, res) {
    const newNodeUrl = req.body.newNodeUrl;
    if((newNodeUrl !== blockchain.currentNodeUrl) && !blockchain.networkNodes.includes(newNodeUrl)) {
        blockchain.networkNodes.push(newNodeUrl);

        try {
            blockchain.networkNodes.forEach(async networkNodeUrl => {
                await axios.post(`${networkNodeUrl}/register-node`, { newNodeUrl })
            });
        
            await axios.post(`${newNodeUrl}/register-nodes-bulk`, {
                networkNodesUrl: [ ...blockchain.networkNodes, blockchain.currentNodeUrl ]
            });
        
            res.json({ note: 'Node registered and broadcasted.' });
        } catch (e) {
            blockchain.networkNodes.pop();
            
            res.json({ error: e.message });
        }
    } else {
        res.json({ info: 'You cannot register this node again!!!' });
    }
});

app.post('/register-node', function(req, res) {
    const newNodeUrl = req.body.newNodeUrl;
    if((newNodeUrl !== blockchain.currentNodeUrl) && !blockchain.networkNodes.includes(newNodeUrl)) {
        blockchain.networkNodes.push(newNodeUrl);

        res.json({ note: 'Node registered successfully.' });
    } else {
        res.json({ note: 'Node is same as current node' });
    }
});

app.post('/register-nodes-bulk', function(req, res) {
    const networkNodesUrl = req.body.networkNodesUrl;
    networkNodesUrl.forEach(networkNodeUrl => {
        if(!blockchain.networkNodes.includes(networkNodeUrl) && (blockchain.currentNodeUrl != networkNodeUrl)) {
            blockchain.networkNodes.push(networkNodeUrl);
        }
    });

    res.json({ note: 'Bulk registration successful.' });
});

app.get('/consensus', function(req, res) {
    try {
        const promiseArray = [];

        blockchain.networkNodes.forEach(networkNodeUrl => {
           promiseArray.push(axios.get(`${networkNodeUrl}/blockchain`));
        });

        Promise.all(promiseArray).then(blockchains => {
            const currentChainLength = blockchain.chain.length;
            let maxChainLength = currentChainLength;
            let newLongestChain = null;
            let newPendingTransactions = null;

            blockchains.forEach(({ data }) => {
                if(data.chain.length > maxChainLength) {
                    maxChainLength = data.chain.length;
                    newLongestChain = data.chain;
                    newPendingTransactions = data.pendingTransactions;
                }
            });

            if(!newLongestChain || (newLongestChain && !blockchain.chainIsValid(newLongestChain))) {
                res.json({ note: 'Current chain has not been replaced', chain: blockchain.chain });
            } else {
                blockchain.chain = newLongestChain;
                blockchain.pendingTransactions = newPendingTransactions;
    
                res.json({ note: 'Current chain has been replaced', chain: blockchain.chain });
            }
        });
    } catch (e) {
        res.json({ error: e.message });
    }
});

app.get('/block/:blockHash', function(req, res) {
    const { blockHash } = req.params;
    const block = blockchain.getBlock(blockHash);
    res.json({ block });
});

app.get('/transaction/:transactionId', function(req, res) {
    const { transactionId } = req.params;
    const transaction = blockchain.getTransaction(transactionId);
    res.json({ transaction });
});

app.get('/address/:address', function(req, res) {
    const { address } = req.params;
    const data = blockchain.getAddressData(address);
    res.json({ addressData: data });
});

app.get('/block-explorer', function(req, res) {
    res.sendFile('./block-explorer/index.html', { root: __dirname });
});



// App listening
app.listen(PORT, function() {
    console.log(`App is running at http://localhost:${PORT}`);
});
