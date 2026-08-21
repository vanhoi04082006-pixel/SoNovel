import React, { useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme, TYPO, RADIUS, SPACING } from '../theme';
import { Icon } from '../components/ui/Icon';
import { AppButton } from '../components/ui/AppButton';
import { supabase } from '../lib/supabase';

export function LoginScreen() {
  const t = useTheme();
  const nav = useNavigation<any>();
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const submit = async () => {
    setError(null);
    setInfo(null);
    if (!email.trim() || !password) {
      setError('Vui lòng nhập email và mật khẩu.');
      return;
    }
    setLoading(true);
    try {
      if (mode === 'login') {
        const { error: err } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (err) throw err;
        nav.goBack();
      } else {
        const { data, error: err } = await supabase.auth.signUp({ email: email.trim(), password });
        if (err) throw err;
        if (data.user && !data.session) {
          setInfo('Đăng ký thành công. Vui lòng đăng nhập.');
          setMode('login');
        } else {
          nav.goBack();
        }
      }
    } catch (e: any) {
      setError(e?.message ?? 'Đã có lỗi xảy ra');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.bg }} edges={['top']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled">
          <LinearGradient colors={t.gradientHero} style={styles.brand}>
            <View style={styles.brandIcon}>
              <Icon name="headset" size={40} color="#fff" />
            </View>
            <Text style={styles.brandTitle}>SoNovel</Text>
            <Text style={styles.brandSub}>
              {mode === 'login' ? 'Đăng nhập để đồng bộ tiến độ' : 'Tạo tài khoản mới'}
            </Text>
          </LinearGradient>

          <View style={styles.form}>
            <View style={[styles.inputWrap, { backgroundColor: t.bgSubtle }]}>
              <Icon name="mail-outline" size={18} color={t.textMuted} />
              <TextInput
                style={[styles.input, { color: t.text }]}
                placeholder="email@example.com"
                placeholderTextColor={t.textMuted}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                value={email}
                onChangeText={setEmail}
              />
            </View>

            <View style={[styles.inputWrap, { backgroundColor: t.bgSubtle }]}>
              <Icon name="lock-closed-outline" size={18} color={t.textMuted} />
              <TextInput
                style={[styles.input, { color: t.text }]}
                placeholder="Mật khẩu"
                placeholderTextColor={t.textMuted}
                secureTextEntry={!show}
                value={password}
                onChangeText={setPassword}
              />
              <Pressable onPress={() => setShow((v) => !v)} hitSlop={8}>
                <Icon name={show ? 'eye-off-outline' : 'eye-outline'} size={18} color={t.textMuted} />
              </Pressable>
            </View>

            {error ? (
              <View style={[styles.msg, { backgroundColor: t.dangerSoft }]}>
                <Icon name="alert-circle" size={14} color={t.danger} />
                <Text style={{ color: t.danger, fontSize: 12, flex: 1 }}>{error}</Text>
              </View>
            ) : null}
            {info ? (
              <View style={[styles.msg, { backgroundColor: t.successSoft }]}>
                <Icon name="checkmark-circle" size={14} color={t.success} />
                <Text style={{ color: t.success, fontSize: 12, flex: 1 }}>{info}</Text>
              </View>
            ) : null}

            <AppButton
              label={mode === 'login' ? 'Đăng nhập' : 'Đăng ký'}
              onPress={submit}
              loading={loading}
              icon={mode === 'login' ? 'log-in-outline' : 'person-add-outline'}
              style={{ marginTop: SPACING.sm }}
            />

            <Pressable
              onPress={() => { setMode(mode === 'login' ? 'signup' : 'login'); setError(null); setInfo(null); }}
              style={styles.switchBtn}
            >
              <Text style={{ color: t.primary, fontSize: 13, fontWeight: '600' }}>
                {mode === 'login' ? 'Chưa có tài khoản? Đăng ký' : 'Đã có tài khoản? Đăng nhập'}
              </Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  brand: {
    paddingVertical: 36,
    alignItems: 'center',
    gap: 6,
    borderBottomLeftRadius: RADIUS.xxl,
    borderBottomRightRadius: RADIUS.xxl,
    paddingHorizontal: 20,
  },
  brandIcon: {
    width: 72,
    height: 72,
    borderRadius: 26,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  brandTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: '#fff',
    fontFamily: 'BeVietnamPro_800ExtraBold',
  },
  brandSub: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.9)',
  },
  form: { padding: 20, gap: 12, paddingTop: 28 },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    height: 48,
    borderRadius: RADIUS.lg,
    paddingHorizontal: 14,
  },
  input: { flex: 1, fontSize: 14, paddingVertical: 0 },
  msg: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: RADIUS.md,
  },
  switchBtn: { alignItems: 'center', paddingVertical: 10 },
});