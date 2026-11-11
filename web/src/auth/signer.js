// Signs NEAR transactions with the Privy embedded wallet.
// Adapted from near-examples/hello-privy (src/context/signer.ts).
import { Account, PublicKey, Signer } from "near-api-js-v7";
import { bytesToHex, hexToBytes } from "@noble/hashes/utils";

export class PrivySigner extends Signer {
  constructor(signRawHash, accountId, provider) {
    super();
    this.signRawHash = signRawHash;
    this.accountId = accountId;
    this.provider = provider;
  }

  async getPublicKey() {
    if (/^[a-f0-9]{64}$/i.test(this.accountId)) {
      return new PublicKey({ keyType: 0, data: hexToBytes(this.accountId) });
    }
    const { keys } = await new Account(this.accountId, this.provider).getAccessKeyList();
    if (!keys.length) throw new Error("The account has no access key");
    return PublicKey.fromString(keys[0].public_key);
  }

  async signBytes(bytes) {
    const { signature } = await this.signRawHash({ address: this.accountId, chainType: "near", hash: `0x${bytesToHex(bytes)}` });
    return hexToBytes(signature.replace(/^0x/, ""));
  }
}
