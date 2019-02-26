const hash = require('hash.js');
const uuid = require('uuid/v1');
const currentNodePort = process.argv[2];
const currentNodeUrl = `http://localhost:${currentNodePort}`;

function Blockchain(nodeAddress) {
    this.chain = [];
    this.pendingTransactions = [];
    this.currentNodeUrl = currentNodeUrl;
    this.networkNodes = [];
    this.nodeAddress = nodeAddress;

    this.createNewBlock(100, '0', '0');
}

Blockchain.prototype.createNewBlock = function(nonce, previousBlockHash, hash) {
    const newBlock = {
        index: this.chain.length + 1,
        timestamp: Date.now(),
        transactions: this.pendingTransactions,
        nonce: nonce,
        hash: hash,
        previousBlockHash: previousBlockHash
    };

    this.pendingTransactions = [];
    this.chain.push(newBlock);

    return newBlock;
}

Blockchain.prototype.getLastBlock = function() {
    return this.chain[this.chain.length - 1];
}

Blockchain.prototype.createNewTransaction = function(amount, sender, recipient) {
    const newTransaction = {
        amount: amount,
        sender: sender,
        recipient: recipient,
        transactionId: uuid().split('-').join(''),
        blockNumber: this.chain.length + 1
    };

    return newTransaction;
}

Blockchain.prototype.addTransactionToPendingTransactions = function(transaction) {
    this.pendingTransactions.push(transaction);

    return this.getLastBlock()['index'] + 1;
}

Blockchain.prototype.hashBlock = function(previousBlockHash, currentBlockData, nonce) {
    const dataToString = previousBlockHash + JSON.stringify(currentBlockData) + nonce.toString();
    const blockHash = hash.sha256().update(dataToString).digest('hex');

    return blockHash;
}

Blockchain.prototype.proofOfWork = function(previousBlockHash, currentBlockData) {
    let nonce = 0;
    let hash = this.hashBlock(previousBlockHash, currentBlockData, nonce);
    while(hash.substring(0, 4) !== '0000') {
        nonce++;
        hash = this.hashBlock(previousBlockHash, currentBlockData, nonce);
    }

    return nonce;
}

Blockchain.prototype.chainIsValid = function(blockchain) {
    let validChain = true;

    for(let i = 1; i < blockchain.length; i++) {
        const currentBlock = blockchain[i];
        const previousBlock = blockchain[i - 1];
        const blockHash = this.hashBlock(previousBlock.hash, { transactions: currentBlock.transactions, index: currentBlock.index }, currentBlock.nonce);

        if(blockHash.substring(0, 4) !== '0000') validChain = false;
        if(currentBlock.previousBlockHash !== previousBlock.hash) validChain = false;
    }

    const genesisBlock = blockchain[0];

    const correctNonce = genesisBlock.nonce === 100;
    const correctPreviousBlockHash = genesisBlock.previousBlockHash === '0';
    const correctHash = genesisBlock.hash === '0';
    const correctTransactions = genesisBlock.transactions.length === 0;

    if(!correctNonce || !correctPreviousBlockHash || !correctHash || !correctTransactions) validChain = false;

    return validChain;
}

Blockchain.prototype.getBlock = function(blockHash) {
    return this.chain.find(block => block.hash === blockHash);
}

Blockchain.prototype.getTransaction = function(transactionId) {
    const transactions = [];
    this.chain.forEach(block => {
        block.transactions.forEach(transaction => {
            transactions.push(transaction);
        });
    });

    return transactions.find(transaction => transaction.transactionId === transactionId);
}

Blockchain.prototype.getAddressData = function(address) {
    const transactions = [];
    this.chain.forEach(block => {
        block.transactions.forEach(transaction => {
            if((transaction.sender === address) || (transaction.recipient == address)) {
                transactions.push(transaction);
            }
        });
    });

    let balance = 0;
    transactions.forEach(transaction => {
        if(address === transaction.recipient) {
            balance += transaction.amount;
        } else if(address === transaction.sender) {
            balance -= transaction.amount;
        }
    });

    return { transactions, balance }
}


module.exports = Blockchain;
