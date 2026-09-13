import { Linking, Alert } from 'react-native';

export function makePhoneCall(phone: string) {
  if (!phone) return;
  const cleaned = phone.replace(/[^0-9+]/g, '');
  const url = `tel:${cleaned}`;
  Linking.canOpenURL(url)
    .then((supported) => {
      if (supported) {
        Linking.openURL(url);
      } else {
        Alert.alert('Phone Call', `Cannot dial ${phone} on this device.`);
      }
    })
    .catch(() => {
      Alert.alert('Phone Call', `Error dialing ${phone}`);
    });
}

export function openWhatsApp(phone: string, text?: string) {
  if (!phone) return;
  const cleaned = phone.replace(/[^0-9]/g, '');
  const encodedText = text ? encodeURIComponent(text) : '';
  const url = `https://wa.me/${cleaned}?text=${encodedText}`;
  Linking.canOpenURL(url)
    .then((supported) => {
      if (supported) {
        Linking.openURL(url);
      } else {
        Alert.alert('WhatsApp', 'WhatsApp is not installed on this device.');
      }
    })
    .catch(() => {
      Alert.alert('WhatsApp', 'Error launching WhatsApp');
    });
}
