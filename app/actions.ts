"use server";

import { encryptPassword, decryptPassword, EncryptedData } from "@/lib/encryption";

/**
 * ENCRYPT ACCOUNT DATA
 * This function runs entirely on the server.
 * It takes the raw password, encrypts it, and returns the encrypted object.
 * We will then save this encrypted object to Firestore from the client.
 */
export async function encryptAccountData(formData: FormData) {
  const password = formData.get("password") as string;

  if (!password) {
    throw new Error("Password is required");
  }

  try {
    // Use the function we created in Step 2
    const encryptedData = encryptPassword(password);

    // Return plain objects (Next.js Server Actions must return serializable data)
    return {
      iv: encryptedData.iv,
      content: encryptedData.content,
      tag: encryptedData.tag,
    };
  } catch (error) {
    console.error("Encryption Failed:", error);
    throw new Error("Failed to encrypt password. Check server logs.");
  }
}

/**
 * ENCRYPT API KEY
 * Encrypts the Gemini API Key on the server before storing it.
 */
export async function encryptApiKey(apiKey: string) {
  if (!apiKey) {
    throw new Error("API Key is required");
  }

  try {
    const encryptedData = encryptPassword(apiKey);
    return {
      iv: encryptedData.iv,
      content: encryptedData.content,
      tag: encryptedData.tag,
    };
  } catch (error) {
    console.error("Encryption Failed:", error);
    throw new Error("Failed to encrypt API Key.");
  }
}

/**
 * DECRYPT API KEY
 * Decrypts the Gemini API Key on the server for session use.
 */
export async function decryptApiKey(data: EncryptedData) {
  if (!data || !data.iv || !data.content || !data.tag) {
    throw new Error("Invalid encrypted data");
  }

  try {
    const recoveredKey = decryptPassword(data);
    return recoveredKey;
  } catch (error) {
    console.error("Decryption Failed:", error);
    throw new Error("Failed to decrypt API Key.");
  }
}