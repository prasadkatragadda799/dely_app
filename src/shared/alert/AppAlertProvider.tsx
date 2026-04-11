import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

export type AppAlertOptions = {
  title: string;
  message: string;
  /** Single-button dismiss label (default: OK) */
  okLabel?: string;
};

export type AppConfirmOptions = {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
};

type ModalState = {
  kind: 'alert' | 'confirm';
  title: string;
  message: string;
  okLabel: string;
  confirmLabel: string;
  cancelLabel: string;
  destructive: boolean;
};

type AppAlertContextValue = {
  /** One primary action — use for errors, success copy, validation. */
  alert: (options: AppAlertOptions) => Promise<void>;
  /** Cancel + confirm — resolves `true` if user confirms. */
  confirm: (options: AppConfirmOptions) => Promise<boolean>;
};

const AppAlertContext = createContext<AppAlertContextValue | null>(null);

export function useAppAlert(): AppAlertContextValue {
  const ctx = useContext(AppAlertContext);
  if (!ctx) {
    throw new Error('useAppAlert must be used within AppAlertProvider');
  }
  return ctx;
}

export function AppAlertProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<ModalState | null>(null);
  const resolveRef = useRef<((value?: boolean) => void) | null>(null);

  const finish = useCallback((value?: boolean) => {
    const fn = resolveRef.current;
    resolveRef.current = null;
    setState(null);
    fn?.(value);
  }, []);

  const alert = useCallback((options: AppAlertOptions) => {
    return new Promise<void>(resolve => {
      resolveRef.current = () => resolve();
      setState({
        kind: 'alert',
        title: options.title,
        message: options.message,
        okLabel: options.okLabel?.trim() || 'OK',
        confirmLabel: 'OK',
        cancelLabel: 'Cancel',
        destructive: false,
      });
    });
  }, []);

  const confirm = useCallback((options: AppConfirmOptions) => {
    return new Promise<boolean>(resolve => {
      resolveRef.current = (v?: boolean) => resolve(v === true);
      setState({
        kind: 'confirm',
        title: options.title,
        message: options.message,
        okLabel: 'OK',
        confirmLabel: options.confirmLabel?.trim() || 'OK',
        cancelLabel: options.cancelLabel?.trim() || 'Cancel',
        destructive: !!options.destructive,
      });
    });
  }, []);

  const value = useMemo(() => ({ alert, confirm }), [alert, confirm]);

  const visible = state != null;
  const onRequestClose = () => {
    if (state?.kind === 'confirm') {
      finish(false);
    } else {
      finish();
    }
  };

  return (
    <AppAlertContext.Provider value={value}>
      {children}
      <Modal
        visible={visible}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={onRequestClose}>
        <Pressable style={styles.backdrop} onPress={() => onRequestClose()}>
          <Pressable style={styles.sheet} onPress={e => e.stopPropagation()}>
            <Text style={styles.title}>{state?.title ?? ''}</Text>
            <ScrollView
              style={styles.messageScroll}
              contentContainerStyle={styles.messageScrollContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}>
              <Text style={styles.message}>{state?.message ?? ''}</Text>
            </ScrollView>
            <View style={styles.actions}>
              {state?.kind === 'confirm' ? (
                <>
                  <Pressable
                    onPress={() => finish(false)}
                    style={({ pressed }) => [
                      styles.btn,
                      styles.btnSecondary,
                      pressed && styles.btnPressed,
                    ]}>
                    <Text style={styles.btnSecondaryText}>{state.cancelLabel}</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => finish(true)}
                    style={({ pressed }) => [
                      styles.btn,
                      state.destructive ? styles.btnDanger : styles.btnPrimary,
                      pressed && styles.btnPressed,
                    ]}>
                    <Text
                      style={
                        state.destructive ? styles.btnDangerText : styles.btnPrimaryText
                      }>
                      {state.confirmLabel}
                    </Text>
                  </Pressable>
                </>
              ) : (
                <Pressable
                  onPress={() => finish()}
                  style={({ pressed }) => [
                    styles.btn,
                    styles.btnPrimary,
                    styles.btnFull,
                    pressed && styles.btnPressed,
                  ]}>
                  <Text style={styles.btnPrimaryText}>{state?.okLabel ?? 'OK'}</Text>
                </Pressable>
              )}
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </AppAlertContext.Provider>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  sheet: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingTop: 22,
    paddingHorizontal: 20,
    paddingBottom: 18,
    maxHeight: '80%',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.2,
    shadowRadius: 24,
    elevation: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0F172A',
    letterSpacing: -0.3,
  },
  messageScroll: {
    maxHeight: 280,
    marginTop: 12,
  },
  messageScrollContent: {
    paddingBottom: 4,
  },
  message: {
    fontSize: 15,
    lineHeight: 22,
    color: '#475569',
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 22,
    flexWrap: 'wrap',
  },
  btn: {
    minWidth: 108,
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnFull: {
    flex: 1,
    minWidth: undefined,
  },
  btnSecondary: {
    backgroundColor: '#F1F5F9',
  },
  btnSecondaryText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#334155',
  },
  btnPrimary: {
    backgroundColor: '#1D4ED8',
  },
  btnPrimaryText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  btnDanger: {
    backgroundColor: '#DC2626',
  },
  btnDangerText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  btnPressed: {
    opacity: 0.88,
  },
});
