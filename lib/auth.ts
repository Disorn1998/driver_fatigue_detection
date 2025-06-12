"use client"

/**
 * Authentication Service
 * Handles user authentication, registration, and profile management
 */

import { useState, useEffect } from "react"
import { onAuthStateChanged } from "firebase/auth"
import { ref, get, remove } from "firebase/database" // Added 'remove' for deleteUser
import {
  database,
  auth,
  signIn as firebaseSignIn,
  registerUser as firebaseRegisterUser,
  signOut as firebaseSignOut,
  // Assuming these are also available from firebase.ts for admin functions
  // deleteUser as firebaseDeleteUser, // This would be for Firebase Admin SDK, not client SDK
} from "./firebase"
import { DEVICE_UTILS, APP_CONFIG } from "./config"
import type { RegisterData, UserProfile, AuthResponse } from "./types"

/**
 * Custom hook for authentication state management
 * Provides user data, profile, and loading states
 */
export const useAuthState = () => {
  const [user, setUser] = useState<any>(null)
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!auth) {
      console.log("🔧 Auth not available, using mock auth state")
      setIsLoading(false)
      return
    }

    console.log("🔥 Auth: Setting up auth state listener")
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      console.log("🔥 Auth state changed:", firebaseUser?.uid || "no user")

      setUser(firebaseUser)

      if (firebaseUser) {
        try {
          const profile = await getUserProfile(firebaseUser.uid)
          setUserProfile(profile)
          console.log("✅ User profile loaded:", profile)
        } catch (error) {
          console.error("❌ Error loading user profile:", error)
          setError("ไม่สามารถโหลดข้อมูลผู้ใช้ได้")
        }
      } else {
        setUserProfile(null)
      }

      setIsLoading(false)
    })

    return unsubscribe
  }, [])

  const isAdmin = userProfile?.role === "admin"

  return { user, userProfile, isAdmin, isLoading, error }
}

/**
 * User registration with device assignment
 */
export const registerUser = async (userData: RegisterData): Promise<AuthResponse> => {
  try {
    console.log("🔥 Firebase: Registering user:", userData.email)

    // Development mode handling
    if (APP_CONFIG.isDevelopmentMode) {
      return handleDevelopmentRegistration(userData)
    }

    const result = await firebaseRegisterUser(userData)
    if (result) {
      return result
    } else {
      return { success: false, error: "การลงทะเบียนล้มเหลว กรุณาลองใหม่อีกครั้ง" }
    }
  } catch (error: any) {
    console.error("❌ Firebase: Registration error:", error)
    return { success: false, error: getAuthErrorMessage(error.code) }
  }
}

/**
 * User login authentication
 */
export const loginUser = async (email: string, password: string): Promise<AuthResponse> => {
  try {
    console.log("🔥 Firebase: Logging in user:", email)

    // Development mode handling
    if (APP_CONFIG.isDevelopmentMode) {
      return handleDevelopmentLogin(email, password)
    }

    const result = await firebaseSignIn(email, password)
    if (result) {
      return result
    } else {
      return { success: false, error: "อีเมลหรือรหัสผ่านไม่ถูกต้อง" }
    }
  } catch (error: any) {
    console.error("❌ Firebase: Login error:", error)
    return { success: false, error: getAuthErrorMessage(error.code) }
  }
}

/**
 * User logout
 */
export const signOut = async (): Promise<{ success: boolean; error?: string }> => {
  try {
    console.log("🔥 Firebase: Signing out user")

    if (APP_CONFIG.isDevelopmentMode) {
      console.log("🔧 Development mode: Simulating logout")
      return { success: true }
    }

    const result = await firebaseSignOut()
    if (result) {
      return result
    } else {
      return { success: false, error: "การออกจากระบบล้มเหลว" }
    }
  } catch (error: any) {
    console.error("❌ Firebase: Sign out error:", error.message)
    return { success: false, error: error.message }
  }
}

/**
 * Get user profile by UID
 */
export const getUserProfile = async (uid: string): Promise<UserProfile | null> => {
  try {
    // Development mode handling
    if (APP_CONFIG.isDevelopmentMode) {
      return getDevelopmentUserProfile(uid)
    }

    if (!database) {
      console.warn("🔧 Firebase not available")
      return null
    }

    console.log(`🔥 Firebase: Getting user profile for ${uid}`)
    const userRef = ref(database, `users/${uid}`)
    const snapshot = await get(userRef)

    if (snapshot.exists()) {
      const userData = snapshot.val()
      return {
        uid,
        role: userData.role || "driver",
        fullName: userData.fullName || "",
        email: userData.email,
        phone: userData.phone || "",
        license: userData.license || "",
        deviceId: userData.deviceId || null,
        registeredAt: userData.registeredAt || new Date().toISOString(),
        promotedToAdminAt: userData.promotedToAdminAt,
      }
    }

    return null
  } catch (error) {
    console.error("🔥 Firebase: Error getting user profile:", error)
    return null
  }
}

/**
 * Get all user profiles (for admin panel)
 */
export const getAllUsers = async (): Promise<UserProfile[]> => {
  try {
    if (APP_CONFIG.isDevelopmentMode) {
      console.log("🔧 Development mode: Simulating getAllUsers")
      const users = JSON.parse(localStorage.getItem("dev-users") || "[]")
      return users.map((user: any) => ({
        uid: user.uid,
        role: user.role || "driver",
        fullName: user.fullName || "",
        email: user.email,
        phone: user.phone || "",
        license: user.license || "",
        deviceId: user.deviceId || null,
        registeredAt: user.registeredAt || new Date().toISOString(),
        promotedToAdminAt: user.promotedToAdminAt,
      }))
    }

    if (!database) {
      console.warn("🔧 Firebase not available")
      return []
    }

    console.log("🔥 Firebase: Getting all user profiles")
    const usersRef = ref(database, "users")
    const snapshot = await get(usersRef)

    if (snapshot.exists()) {
      const usersData = snapshot.val()
      return Object.keys(usersData).map((uid) => {
        const userData = usersData[uid]
        return {
          uid,
          role: userData.role || "driver",
          fullName: userData.fullName || "",
          email: userData.email,
          phone: userData.phone || "",
          license: userData.license || "",
          deviceId: userData.deviceId || null,
          registeredAt: userData.registeredAt || new Date().toISOString(),
          promotedToAdminAt: userData.promotedToAdminAt,
        }
      })
    }

    return []
  } catch (error) {
    console.error("🔥 Firebase: Error getting all user profiles:", error)
    return []
  }
}

/**
 * Delete a user (for admin panel)
 */
export const deleteUser = async (uid: string): Promise<{ success: boolean; error?: string }> => {
  try {
    if (APP_CONFIG.isDevelopmentMode) {
      console.log(`🔧 Development mode: Simulating deleteUser for UID: ${uid}`)
      let users = JSON.parse(localStorage.getItem("dev-users") || "[]")
      const initialLength = users.length
      users = users.filter((user: any) => user.uid !== uid)
      localStorage.setItem("dev-users", JSON.stringify(users))
      if (users.length < initialLength) {
        return { success: true }
      } else {
        return { success: false, error: "ไม่พบผู้ใช้ที่ต้องการลบ" }
      }
    }

    if (!database) {
      return { success: false, error: "Firebase database not available" }
    }

    console.log(`🔥 Firebase: Deleting user with UID: ${uid}`)
    const userRef = ref(database, `users/${uid}`)
    await remove(userRef) // Use Firebase Realtime Database remove operation

    // Note: Deleting user authentication record (from firebase/auth) usually requires Firebase Admin SDK
    // This client-side function only removes the profile from Realtime Database.
    // For a complete user deletion (auth + database), a server-side function would be needed.

    return { success: true }
  } catch (error: any) {
    console.error("❌ Firebase: Error deleting user:", error)
    return { success: false, error: error.message || "เกิดข้อผิดพลาดในการลบผู้ใช้" }
  }
}

/**
 * Get display ID for a device
 */
export const getDeviceDisplayId = (deviceId: string | null): string => {
  if (!deviceId) {
    return "N/A"
  }
  return DEVICE_UTILS.getDisplayId ? DEVICE_UTILS.getDisplayId(deviceId) : deviceId;
}

/**
 * Normalize a device ID
 */
export const normalizeDeviceId = (deviceId: string): string => {
  return DEVICE_UTILS.normalize ? DEVICE_UTILS.normalize(deviceId) : deviceId;
}


/**
 * Development mode helper functions
 */
const handleDevelopmentRegistration = (userData: RegisterData): AuthResponse => {
  console.log("🔧 Development mode: Simulating user registration")

  const users = JSON.parse(localStorage.getItem("dev-users") || "[]")
  const existingUser = users.find((u: any) => u.email === userData.email)

  if (existingUser) {
    return { success: false, error: "อีเมลนี้ถูกใช้งานแล้ว" }
  }

  const deviceId = normalizeDeviceId(userData.deviceId) // Using the new normalizeDeviceId
  const deviceUsed = users.some((u: any) => u.deviceId === deviceId)

  if (deviceUsed) {
    return { success: false, error: "Device ID นี้ถูกใช้งานแล้ว" }
  }

  const mockUser = {
    uid: `dev-user-${Date.now()}`,
    email: userData.email,
    password: userData.password,
    fullName: userData.fullName,
    phone: userData.phone,
    license: userData.license || "",
    deviceId: deviceId,
    role: userData.role || "driver",
    registeredAt: new Date().toISOString(),
  }

  users.push(mockUser)
  localStorage.setItem("dev-users", JSON.stringify(users))

  return { success: true, user: mockUser }
}

const handleDevelopmentLogin = (email: string, password: string): AuthResponse => {
  console.log("🔧 Development mode: Simulating login")

  const users = JSON.parse(localStorage.getItem("dev-users") || "[]")
  const user = users.find((u: any) => u.email === email && u.password === password)

  if (user) {
    const updatedUsers = users.map((u: any) =>
      u.email === email ? { ...u, lastLoginAt: new Date().toISOString() } : u,
    )
    localStorage.setItem("dev-users", JSON.stringify(updatedUsers))

    return {
      success: true,
      user: {
        uid: user.uid,
        email: user.email,
        displayName: user.fullName,
      },
    }
  }

  return { success: false, error: "อีเมลหรือรหัสผ่านไม่ถูกต้อง" }
}

const getDevelopmentUserProfile = (uid: string): UserProfile | null => {
  const users = JSON.parse(localStorage.getItem("dev-users") || "[]")
  const user = users.find((u: any) => u.uid === uid)

  if (user) {
    return {
      uid: user.uid,
      role: user.role || "driver",
      fullName: user.fullName || "",
      email: user.email,
      phone: user.phone || "",
      license: user.license || "",
      deviceId: user.deviceId || null,
      registeredAt: user.registeredAt || new Date().toISOString(),
      promotedToAdminAt: user.promotedToAdminAt,
    }
  }

  return null
}

/**
 * Convert Firebase auth error codes to Thai messages
 */
const getAuthErrorMessage = (errorCode: string): string => {
  const errorMessages: { [key: string]: string } = {
    "auth/email-already-in-use": "อีเมลนี้ถูกใช้งานแล้ว",
    "auth/weak-password": "รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร",
    "auth/invalid-email": "รูปแบบอีเมลไม่ถูกต้อง",
    "auth/user-not-found": "อีเมลหรือรหัสผ่านไม่ถูกต้อง",
    "auth/wrong-password": "อีเมลหรือรหัสผ่านไม่ถูกต้อง",
    "auth/network-request-failed": "เกิดข้อผิดพลาดในการเชื่อมต่อ กรุณาตรวจสอบอินเทอร์เน็ต",
    "auth/too-many-requests": "มีการพยายามเข้าสู่ระบบมากเกินไป กรุณารอสักครู่",
  }

  return errorMessages[errorCode] || "เกิดข้อผิดพลาดในการดำเนินการ กรุณาลองใหม่อีกครั้ง"
}

/**
 * Sign in user (alias for loginUser for backward compatibility)
 */
export const signIn = async (email: string, password: string): Promise<AuthResponse> => {
  return await loginUser(email, password)
}

console.log("🔥 Auth service initialized with error recovery")
