import * as SecureStore from "expo-secure-store";

const REFRESH_KEY = "t2w.refreshToken";
const DEVICE_ID_KEY = "t2w.deviceId";

export const tokenStorage = {
  async getRefreshToken() {
    return SecureStore.getItemAsync(REFRESH_KEY);
  },
  async setRefreshToken(token: string) {
    await SecureStore.setItemAsync(REFRESH_KEY, token);
  },
  async clear() {
    await SecureStore.deleteItemAsync(REFRESH_KEY);
  },
};

export const deviceStorage = {
  async getDeviceId() {
    return SecureStore.getItemAsync(DEVICE_ID_KEY);
  },
  async setDeviceId(id: string) {
    await SecureStore.setItemAsync(DEVICE_ID_KEY, id);
  },
};
