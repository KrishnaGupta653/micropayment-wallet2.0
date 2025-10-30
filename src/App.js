import React, { useState, useEffect } from "react";
import {
  Wallet,
  Key,
  Send,
  ArrowUpRight,
  ArrowDownLeft,
  Shield,
  QrCode,
  Check,
} from "lucide-react";

// Simple TOTP implementation for demo
const generateSecret = () => {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let secret = "";
  for (let i = 0; i < 32; i++) {
    secret += chars[Math.floor(Math.random() * chars.length)];
  }
  return secret;
};

const base32Decode = (secret) => {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = "";
  for (let i = 0; i < secret.length; i++) {
    const val = alphabet.indexOf(secret.charAt(i).toUpperCase());
    if (val === -1) continue;
    bits += val.toString(2).padStart(5, "0");
  }
  const bytes = new Uint8Array(Math.floor(bits.length / 8));
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(bits.substr(i * 8, 8), 2);
  }
  return bytes;
};

const hmacSha1 = async (key, message) => {
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    key,
    { name: "HMAC", hash: "SHA-1" } ,
    false,
    ["sign"]
  );
  return await crypto.subtle.sign("HMAC", cryptoKey, message);
};

const generateTOTP = async (secret) => {
  const epoch = Math.floor(Date.now() / 1000);
  const time = Math.floor(epoch / 30);
  const timeBytes = new ArrayBuffer(8);
  const view = new DataView(timeBytes);
  // eslint-disable-next-line no-undef
  view.setBigUint64(0, BigInt(time), false);

  const key = base32Decode(secret);
  const hmac = await hmacSha1(key, timeBytes);
  const hmacArray = new Uint8Array(hmac);

  const offset = hmacArray[hmacArray.length - 1] & 0x0f;
  const code =
    (((hmacArray[offset] & 0x7f) << 24) |
      ((hmacArray[offset + 1] & 0xff) << 16) |
      ((hmacArray[offset + 2] & 0xff) << 8) |
      (hmacArray[offset + 3] & 0xff)) %
    1000000;

  return code.toString().padStart(6, "0");
};

export default function MicroPaymentWallet() {
  const [isSetup, setIsSetup] = useState(false);
  const [secret, setSecret] = useState("");
  const [balance, setBalance] = useState(0);
  const [transactions, setTransactions] = useState([]);
  const [showSendModal, setShowSendModal] = useState(false);
  const [recipient, setRecipient] = useState("");
  const [amount, setAmount] = useState("");
  const [otpInput, setOtpInput] = useState("");
  const [showSetupQR, setShowSetupQR] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    const stored = localStorage.getItem("walletSecret");
    const storedBalance = localStorage.getItem("walletBalance");
    const storedTxns = localStorage.getItem("walletTransactions");

    if (stored) {
      setSecret(stored);
      setIsSetup(true);
      setBalance(storedBalance ? parseFloat(storedBalance) : 100);
      setTransactions(storedTxns ? JSON.parse(storedTxns) : []);
    }
  }, []);

  const setupWallet = () => {
    const newSecret = generateSecret();
    setSecret(newSecret);
    setShowSetupQR(true);
  };

  const confirmSetup = () => {
    localStorage.setItem("walletSecret", secret);
    localStorage.setItem("walletBalance", "100");
    setBalance(100);
    setIsSetup(true);
    setShowSetupQR(false);
    setSuccess("Wallet setup complete! Starting balance: $100");
  };

  const verifyOTP = async (inputOtp) => {
    const validOtp = await generateTOTP(secret);
    return inputOtp === validOtp;
  };

  const handleSendPayment = async () => {
    setError("");
    setSuccess("");

    if (!recipient || !amount || !otpInput) {
      setError("Please fill all fields");
      return;
    }

    const amt = parseFloat(amount);
    if (amt <= 0 || amt > balance) {
      setError("Invalid amount");
      return;
    }

    const isValid = await verifyOTP(otpInput);
    if (!isValid) {
      setError("Invalid OTP code");
      return;
    }

    const newBalance = balance - amt;
    const newTxn = {
      id: Date.now(),
      type: "sent",
      recipient,
      amount: amt,
      timestamp: new Date().toISOString(),
    };

    const updatedTxns = [newTxn, ...transactions];

    setBalance(newBalance);
    setTransactions(updatedTxns);
    localStorage.setItem("walletBalance", newBalance.toString());
    localStorage.setItem("walletTransactions", JSON.stringify(updatedTxns));

    setSuccess(`Successfully sent $${amt.toFixed(2)} to ${recipient}`);
    setShowSendModal(false);
    setRecipient("");
    setAmount("");
    setOtpInput("");
  };

  const addFunds = () => {
    const newBalance = balance + 50;
    setBalance(newBalance);
    localStorage.setItem("walletBalance", newBalance.toString());

    const newTxn = {
      id: Date.now(),
      type: "received",
      recipient: "Self",
      amount: 50,
      timestamp: new Date().toISOString(),
    };
    const updatedTxns = [newTxn, ...transactions];
    setTransactions(updatedTxns);
    localStorage.setItem("walletTransactions", JSON.stringify(updatedTxns));
    setSuccess("Added $50 to wallet");
  };

  if (!isSetup && !showSetupQR) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-indigo-100 rounded-full mb-4">
              <Wallet className="w-10 h-10 text-indigo-600" />
            </div>
            <h1 className="text-3xl font-bold text-gray-800 mb-2">
              Secure Wallet
            </h1>
            <p className="text-gray-600">
              Setup Google Authenticator for secure payments
            </p>
          </div>

          <button
            onClick={setupWallet}
            className="w-full bg-indigo-600 text-white py-4 rounded-xl font-semibold hover:bg-indigo-700 transition flex items-center justify-center gap-2"
          >
            <Shield className="w-5 h-5" />
            Setup Wallet with 2FA
          </button>
        </div>
      </div>
    );
  }

  if (showSetupQR) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full">
          <div className="text-center mb-6">
            <QrCode className="w-12 h-12 text-indigo-600 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-gray-800 mb-2">
              Scan QR Code
            </h2>
            <p className="text-gray-600 text-sm">
              Use Google Authenticator to scan this code
            </p>
          </div>

          <div className="bg-gray-50 p-6 rounded-xl mb-6">
            <div className="bg-white p-4 rounded-lg mb-4 text-center">
              <p className="text-xs text-gray-500 mb-2">Manual Entry Code:</p>
              <p className="text-sm font-mono font-bold text-indigo-600 break-all">
                {secret}
              </p>
            </div>
            <p className="text-xs text-gray-600 text-center">
              Or manually enter this code in Google Authenticator
            </p>
          </div>

          <div className="space-y-3">
            <button
              onClick={confirmSetup}
              className="w-full bg-indigo-600 text-white py-3 rounded-xl font-semibold hover:bg-indigo-700 transition flex items-center justify-center gap-2"
            >
              <Check className="w-5 h-5" />
              I've Scanned the Code
            </button>
            <button
              onClick={() => setShowSetupQR(false)}
              className="w-full bg-gray-200 text-gray-700 py-3 rounded-xl font-semibold hover:bg-gray-300 transition"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 p-4">
      <div className="max-w-2xl mx-auto py-8">
        {(error || success) && (
          <div
            className={`mb-4 p-4 rounded-xl ${
              error ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"
            }`}
          >
            {error || success}
          </div>
        )}

        <div className="bg-white rounded-2xl shadow-2xl p-6 mb-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-indigo-100 rounded-full flex items-center justify-center">
                <Wallet className="w-6 h-6 text-indigo-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Total Balance</p>
                <h2 className="text-3xl font-bold text-gray-800">
                  ${balance.toFixed(2)}
                </h2>
              </div>
            </div>
            <Shield className="w-8 h-8 text-green-500" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <button
              onClick={() => setShowSendModal(true)}
              className="bg-indigo-600 text-white py-3 rounded-xl font-semibold hover:bg-indigo-700 transition flex items-center justify-center gap-2"
            >
              <Send className="w-5 h-5" />
              Send
            </button>
            <button
              onClick={addFunds}
              className="bg-green-600 text-white py-3 rounded-xl font-semibold hover:bg-green-700 transition flex items-center justify-center gap-2"
            >
              <ArrowDownLeft className="w-5 h-5" />
              Add Funds
            </button>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-2xl p-6">
          <h3 className="text-xl font-bold text-gray-800 mb-4">
            Recent Transactions
          </h3>
          {transactions.length === 0 ? (
            <p className="text-gray-500 text-center py-8">
              No transactions yet
            </p>
          ) : (
            <div className="space-y-3">
              {transactions.map((txn) => (
                <div
                  key={txn.id}
                  className="flex items-center justify-between p-4 bg-gray-50 rounded-xl"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-10 h-10 rounded-full flex items-center justify-center ${
                        txn.type === "sent" ? "bg-red-100" : "bg-green-100"
                      }`}
                    >
                      {txn.type === "sent" ? (
                        <ArrowUpRight className="w-5 h-5 text-red-600" />
                      ) : (
                        <ArrowDownLeft className="w-5 h-5 text-green-600" />
                      )}
                    </div>
                    <div>
                      <p className="font-semibold text-gray-800">
                        {txn.type === "sent" ? "Sent to" : "Received from"}{" "}
                        {txn.recipient}
                      </p>
                      <p className="text-xs text-gray-500">
                        {new Date(txn.timestamp).toLocaleString()}
                      </p>
                    </div>
                  </div>
                  <p
                    className={`font-bold ${
                      txn.type === "sent" ? "text-red-600" : "text-green-600"
                    }`}
                  >
                    {txn.type === "sent" ? "-" : "+"}${txn.amount.toFixed(2)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        {showSendModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-2xl p-6 max-w-md w-full">
              <h3 className="text-2xl font-bold text-gray-800 mb-6">
                Send Payment
              </h3>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Recipient
                  </label>
                  <input
                    type="text"
                    value={recipient}
                    onChange={(e) => setRecipient(e.target.value)}
                    placeholder="Enter recipient address"
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Amount ($)
                  </label>
                  <input
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0.00"
                    step="0.01"
                    min="0"
                    max={balance}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    <div className="flex items-center gap-2">
                      <Key className="w-4 h-4" />
                      Google Authenticator Code
                    </div>
                  </label>
                  <input
                    type="text"
                    value={otpInput}
                    onChange={(e) =>
                      setOtpInput(e.target.value.replace(/\D/g, "").slice(0, 6))
                    }
                    placeholder="000000"
                    maxLength="6"
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-center text-2xl font-mono"
                  />
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    onClick={() => {
                      setShowSendModal(false);
                      setRecipient("");
                      setAmount("");
                      setOtpInput("");
                      setError("");
                    }}
                    className="flex-1 bg-gray-200 text-gray-700 py-3 rounded-xl font-semibold hover:bg-gray-300 transition"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSendPayment}
                    className="flex-1 bg-indigo-600 text-white py-3 rounded-xl font-semibold hover:bg-indigo-700 transition flex items-center justify-center gap-2"
                  >
                    <Send className="w-5 h-5" />
                    Send
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}