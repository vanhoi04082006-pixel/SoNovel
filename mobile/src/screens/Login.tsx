import React, { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../theme';
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
      <View style={styles.wrap}>
        <Text style={[styles.title, { color: t.text }]}>SoNovel</Text>
        <Text style={[styles.sub, { color: t.textMuted }]}>
          {mode === 'login' ? 'Đăng nhập để đồng bộ tiến độ' : 'Tạo tài khoản mới'}
        </Text>

        <View style={styles.inputWrap}>
          <Text style={[styles.label, { color: t.textMuted }]}>Email</Text>
          <TextInput
            style={[styles.input, { backgroundColor: t.bgSubtle, color: t.text, borderColor: t.border }]}
            placeholder="email@example.com"
            placeholderTextColor={t.textMuted}
            keyboardType="email-address"
            autoCapitalize="none"
            value={email}
            onChangeText={setEmail}
          />
        </View>

        <View style={styles.inputWrap}>
          <Text style={[styles.label, { color: t.textMuted }]}>Mật khẩu</Text>
          <View style={[styles.pwRow, { backgroundColor: t.bgSubtle, borderColor: t.border }]}>
            <TextInput
              style={[styles.inputInline, { color: t.text }]}
              placeholder="••••••••"
              placeholderTextColor={t.textMuted}
              secureTextEntry={!show}
              value={password}
              onChangeText={setPassword}
            />
            <Pressable onPress={() => setShow((v) => !v)} style={styles.pwToggle}>
              <Text style={{ color: t.primary, fontSize: 12 }}>{show ? 'Ẩn' : 'Hiện'}</Text>
            </Pressable>
          </View>
        </View>

        {error ? <Text style={[styles.error, { color: t.danger }]}>{error}</Text> : null}
        {info ? <Text style={[styles.info, { color: t.success }]}>{info}</Text> : null}

        <Pressable
          onPress={submit}
          disabled={loading}
          style={[styles.btn, { backgroundColor: t.primary, opacity: loading ? 0.6 : 1 }]}
        >
          {loading ? (
            <ActivityIndicator color={t.primaryText} />
          ) : (
            <Text style={[styles.btnLabel, { color: t.primaryText }]}>
              {mode === 'login' ? 'Đăng nhập' : 'Đăng ký'}
            </Text>
          )}
        </Pressable>

        <Pressable
          onPress={() => { setMode(mode === 'login' ? 'signup' : 'login'); setError(null); setInfo(null); }}
          style={styles.switchBtn}
        >
          <Text style={{ color: t.primary, fontSize: 13 }}>
            {mode === 'login' ? 'Chưa có tài khoản? Đăng ký' : 'Đã có tài khoản? Đăng nhập'}
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: 20, gap: 12 },
  title: { fontSize: 24, fontWeight: '700', marginTop: 12 },
  sub: { fontSize: 13, marginBottom: 12 },
  inputWrap: { gap: 6 },
  label: { fontSize: 12 },
  input: {
    height: 44,
    borderRadius: 8,
    paddingHorizontal: 12,
    borderWidth: 1,
    fontSize: 14,
  },
  pwRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
    paddingRight: 8,
  },
  inputInline: { flex: 1, height: 44, paddingHorizontal: 12, fontSize: 14 },
  pwToggle: { paddingHorizontal: 8 },
  error: { fontSize: 12 },
  info: { fontSize: 12 },
  btn: {
    height: 44,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  btnLabel: { fontSize: 15, fontWeight: '600' },
  switchBtn: { alignItems: 'center', paddingVertical: 8 },
});
