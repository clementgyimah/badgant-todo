import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  FlatList,
  Animated,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Dimensions,
  Alert,
  Image,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ─── Types ───────────────────────────────────────────────────────────────────

interface Todo {
  id: string;
  text: string;
  completed: boolean;
  createdAt: number;
}

type FilterType = 'all' | 'active' | 'completed';

// ─── Constants ───────────────────────────────────────────────────────────────

const STORAGE_KEY = '@badgant_todos';
const { width: SCREEN_WIDTH } = Dimensions.get('window');

const COLORS = {
  bg: '#0f0f23',
  surface: '#1a1a2e',
  surfaceLight: '#222240',
  accent: '#6c5ce7',
  accentLight: '#a29bfe',
  teal: '#00cec9',
  tealLight: '#55efc4',
  text: '#f5f5f7',
  textSecondary: '#8e8ea0',
  textMuted: '#4a4a6a',
  danger: '#ff6b6b',
  dangerLight: '#ee5a6f',
  border: '#2a2a4a',
  inputBg: '#16163a',
  completed: '#2d2d50',
};

// ─── Animated Todo Item ──────────────────────────────────────────────────────

interface TodoItemProps {
  item: Todo;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
  index: number;
}

const TodoItem: React.FC<TodoItemProps> = React.memo(({ item, onToggle, onDelete, index }) => {
  const slideAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.8)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: 1,
        duration: 400,
        delay: index * 50,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 8,
        tension: 40,
        delay: index * 50,
        useNativeDriver: true,
      }),
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        delay: index * 50,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const handleDelete = () => {
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => onDelete(item.id));
  };

  const translateX = slideAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [SCREEN_WIDTH, 0],
  });

  const formattedDate = new Date(item.createdAt).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <Animated.View
      style={[
        styles.todoItem,
        item.completed && styles.todoItemCompleted,
        {
          opacity: fadeAnim,
          transform: [{ translateX }, { scale: scaleAnim }],
        },
      ]}
    >
      <TouchableOpacity
        style={styles.todoCheckbox}
        onPress={() => onToggle(item.id)}
        activeOpacity={0.7}
      >
        <View
          style={[
            styles.checkbox,
            item.completed && styles.checkboxChecked,
          ]}
        >
          {item.completed && <Text style={styles.checkmark}>✓</Text>}
        </View>
      </TouchableOpacity>

      <View style={styles.todoContent}>
        <Text
          style={[
            styles.todoText,
            item.completed && styles.todoTextCompleted,
          ]}
          numberOfLines={2}
        >
          {item.text}
        </Text>
        <Text style={styles.todoDate}>{formattedDate}</Text>
      </View>

      <TouchableOpacity
        style={styles.deleteButton}
        onPress={handleDelete}
        activeOpacity={0.7}
      >
        <Text style={styles.deleteIcon}>×</Text>
      </TouchableOpacity>
    </Animated.View>
  );
});

// ─── Filter Button ───────────────────────────────────────────────────────────

interface FilterButtonProps {
  label: string;
  active: boolean;
  onPress: () => void;
  count: number;
}

const FilterButton: React.FC<FilterButtonProps> = ({ label, active, onPress, count }) => (
  <TouchableOpacity
    style={[styles.filterButton, active && styles.filterButtonActive]}
    onPress={onPress}
    activeOpacity={0.7}
  >
    <Text style={[styles.filterText, active && styles.filterTextActive]}>
      {label}
    </Text>
    <View style={[styles.filterBadge, active && styles.filterBadgeActive]}>
      <Text style={[styles.filterBadgeText, active && styles.filterBadgeTextActive]}>
        {count}
      </Text>
    </View>
  </TouchableOpacity>
);

// ─── Empty State ─────────────────────────────────────────────────────────────

const EmptyState: React.FC<{ filter: FilterType }> = ({ filter }) => {
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 600,
      useNativeDriver: true,
    }).start();
  }, []);

  const getMessage = () => {
    switch (filter) {
      case 'active':
        return { emoji: '🎉', title: 'All done!', subtitle: 'No active tasks remaining' };
      case 'completed':
        return { emoji: '📋', title: 'Nothing yet', subtitle: 'Complete some tasks to see them here' };
      default:
        return { emoji: '✨', title: 'Start fresh', subtitle: 'Add your first task above' };
    }
  };

  const { emoji, title, subtitle } = getMessage();

  return (
    <Animated.View style={[styles.emptyState, { opacity: fadeAnim }]}>
      <Text style={styles.emptyEmoji}>{emoji}</Text>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptySubtitle}>{subtitle}</Text>
    </Animated.View>
  );
};

// ─── Main App ────────────────────────────────────────────────────────────────

export default function App() {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [inputText, setInputText] = useState('');
  const [filter, setFilter] = useState<FilterType>('all');
  const [isLoaded, setIsLoaded] = useState(false);

  const headerAnim = useRef(new Animated.Value(0)).current;
  const inputAnim = useRef(new Animated.Value(0)).current;

  // Load todos from AsyncStorage
  useEffect(() => {
    loadTodos();
  }, []);

  // Animate header on mount
  useEffect(() => {
    if (isLoaded) {
      Animated.stagger(150, [
        Animated.spring(headerAnim, {
          toValue: 1,
          friction: 8,
          tension: 40,
          useNativeDriver: true,
        }),
        Animated.spring(inputAnim, {
          toValue: 1,
          friction: 8,
          tension: 40,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [isLoaded]);

  const loadTodos = async () => {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      if (stored) {
        setTodos(JSON.parse(stored));
      }
    } catch (error) {
      console.error('Failed to load todos:', error);
    } finally {
      setIsLoaded(true);
    }
  };

  const saveTodos = async (updatedTodos: Todo[]) => {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updatedTodos));
    } catch (error) {
      console.error('Failed to save todos:', error);
    }
  };

  const addTodo = useCallback(() => {
    const trimmed = inputText.trim();
    if (!trimmed) return;

    const newTodo: Todo = {
      id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
      text: trimmed,
      completed: false,
      createdAt: Date.now(),
    };

    const updated = [newTodo, ...todos];
    setTodos(updated);
    saveTodos(updated);
    setInputText('');
    Keyboard.dismiss();
  }, [inputText, todos]);

  const toggleTodo = useCallback((id: string) => {
    const updated = todos.map((todo) =>
      todo.id === id ? { ...todo, completed: !todo.completed } : todo
    );
    setTodos(updated);
    saveTodos(updated);
  }, [todos]);

  const deleteTodo = useCallback((id: string) => {
    const updated = todos.filter((todo) => todo.id !== id);
    setTodos(updated);
    saveTodos(updated);
  }, [todos]);

  const clearCompleted = () => {
    const completedCount = todos.filter((t) => t.completed).length;
    if (completedCount === 0) return;

    Alert.alert(
      'Clear Completed',
      `Remove ${completedCount} completed task${completedCount > 1 ? 's' : ''}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: () => {
            const updated = todos.filter((t) => !t.completed);
            setTodos(updated);
            saveTodos(updated);
          },
        },
      ]
    );
  };

  // Computed values
  const activeTodos = todos.filter((t) => !t.completed);
  const completedTodos = todos.filter((t) => t.completed);

  const filteredTodos = (() => {
    switch (filter) {
      case 'active':
        return activeTodos;
      case 'completed':
        return completedTodos;
      default:
        return todos;
    }
  })();

  const headerTranslateY = headerAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-50, 0],
  });

  const inputTranslateY = inputAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [50, 0],
  });

  if (!isLoaded) {
    return (
      <View style={styles.loadingContainer}>
        <Image
          source={require('./assets/icons/app-icon.png')}
          style={styles.loadingIcon}
        />
        <StatusBar style="light" />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <StatusBar style="light" />

      {/* Background Gradient Overlay */}
      <View style={styles.gradientOverlay} />

      {/* Header */}
      <Animated.View
        style={[
          styles.header,
          {
            opacity: headerAnim,
            transform: [{ translateY: headerTranslateY }],
          },
        ]}
      >
        <View style={styles.headerTop}>
          <View style={styles.headerLeft}>
            <Image
              source={require('./assets/icons/app-icon.png')}
              style={styles.headerIcon}
            />
            <View>
              <Text style={styles.headerTitle}>Badgant</Text>
              <Text style={styles.headerSubtitle}>
                {activeTodos.length} task{activeTodos.length !== 1 ? 's' : ''} remaining
              </Text>
            </View>
          </View>

          {completedTodos.length > 0 && (
            <TouchableOpacity
              style={styles.clearButton}
              onPress={clearCompleted}
              activeOpacity={0.7}
            >
              <Text style={styles.clearButtonText}>Clear done</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Progress Bar */}
        {todos.length > 0 && (
          <View style={styles.progressContainer}>
            <View style={styles.progressTrack}>
              <View
                style={[
                  styles.progressFill,
                  {
                    width: `${(completedTodos.length / todos.length) * 100}%`,
                  },
                ]}
              />
            </View>
            <Text style={styles.progressText}>
              {completedTodos.length}/{todos.length}
            </Text>
          </View>
        )}
      </Animated.View>

      {/* Input Area */}
      <Animated.View
        style={[
          styles.inputContainer,
          {
            opacity: inputAnim,
            transform: [{ translateY: inputTranslateY }],
          },
        ]}
      >
        <View style={styles.inputWrapper}>
          <TextInput
            style={styles.input}
            placeholder="What needs to be done?"
            placeholderTextColor={COLORS.textMuted}
            value={inputText}
            onChangeText={setInputText}
            onSubmitEditing={addTodo}
            returnKeyType="done"
            blurOnSubmit={false}
          />
          <TouchableOpacity
            style={[styles.addButton, !inputText.trim() && styles.addButtonDisabled]}
            onPress={addTodo}
            activeOpacity={0.7}
            disabled={!inputText.trim()}
          >
            <Text style={styles.addButtonText}>+</Text>
          </TouchableOpacity>
        </View>
      </Animated.View>

      {/* Filters */}
      <View style={styles.filterContainer}>
        <FilterButton
          label="All"
          active={filter === 'all'}
          onPress={() => setFilter('all')}
          count={todos.length}
        />
        <FilterButton
          label="Active"
          active={filter === 'active'}
          onPress={() => setFilter('active')}
          count={activeTodos.length}
        />
        <FilterButton
          label="Done"
          active={filter === 'completed'}
          onPress={() => setFilter('completed')}
          count={completedTodos.length}
        />
      </View>

      {/* Todo List */}
      <FlatList
        data={filteredTodos}
        keyExtractor={(item) => item.id}
        renderItem={({ item, index }) => (
          <TodoItem
            item={item}
            onToggle={toggleTodo}
            onDelete={deleteTodo}
            index={index}
          />
        )}
        ListEmptyComponent={<EmptyState filter={filter} />}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      />
    </KeyboardAvoidingView>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  gradientOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 300,
    backgroundColor: COLORS.accent,
    opacity: 0.05,
    borderBottomLeftRadius: 40,
    borderBottomRightRadius: 40,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: COLORS.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingIcon: {
    width: 80,
    height: 80,
    borderRadius: 20,
  },

  // Header
  header: {
    paddingTop: Platform.OS === 'ios' ? 60 : 48,
    paddingHorizontal: 24,
    paddingBottom: 16,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: COLORS.text,
    letterSpacing: -0.5,
  },
  headerSubtitle: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  clearButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: COLORS.danger + '18',
    borderWidth: 1,
    borderColor: COLORS.danger + '30',
  },
  clearButtonText: {
    fontSize: 13,
    color: COLORS.danger,
    fontWeight: '600',
  },

  // Progress
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
    gap: 10,
  },
  progressTrack: {
    flex: 1,
    height: 6,
    backgroundColor: COLORS.border,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
    backgroundColor: COLORS.teal,
  },
  progressText: {
    fontSize: 12,
    color: COLORS.textSecondary,
    fontWeight: '600',
    minWidth: 32,
    textAlign: 'right',
  },

  // Input
  inputContainer: {
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 16,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.inputBg,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: 'hidden',
  },
  input: {
    flex: 1,
    paddingHorizontal: 20,
    paddingVertical: 16,
    fontSize: 16,
    color: COLORS.text,
  },
  addButton: {
    width: 52,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.accent,
    margin: 4,
    borderRadius: 14,
  },
  addButtonDisabled: {
    backgroundColor: COLORS.textMuted,
    opacity: 0.4,
  },
  addButtonText: {
    fontSize: 28,
    fontWeight: '300',
    color: '#fff',
    marginTop: -2,
  },

  // Filters
  filterContainer: {
    flexDirection: 'row',
    paddingHorizontal: 24,
    paddingBottom: 12,
    gap: 8,
  },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: COLORS.surface,
    gap: 6,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  filterButtonActive: {
    backgroundColor: COLORS.accent + '20',
    borderColor: COLORS.accent + '50',
  },
  filterText: {
    fontSize: 13,
    color: COLORS.textSecondary,
    fontWeight: '600',
  },
  filterTextActive: {
    color: COLORS.accentLight,
  },
  filterBadge: {
    backgroundColor: COLORS.surfaceLight,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 8,
    minWidth: 22,
    alignItems: 'center',
  },
  filterBadgeActive: {
    backgroundColor: COLORS.accent + '40',
  },
  filterBadgeText: {
    fontSize: 11,
    color: COLORS.textMuted,
    fontWeight: '700',
  },
  filterBadgeTextActive: {
    color: COLORS.accentLight,
  },

  // List
  listContent: {
    paddingHorizontal: 24,
    paddingBottom: 40,
    flexGrow: 1,
  },

  // Todo Item
  todoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  todoItemCompleted: {
    backgroundColor: COLORS.completed,
    borderColor: COLORS.border,
    opacity: 0.7,
  },
  todoCheckbox: {
    marginRight: 14,
  },
  checkbox: {
    width: 26,
    height: 26,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: COLORS.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: COLORS.teal,
    borderColor: COLORS.teal,
  },
  checkmark: {
    fontSize: 14,
    color: '#fff',
    fontWeight: '800',
  },
  todoContent: {
    flex: 1,
  },
  todoText: {
    fontSize: 15,
    color: COLORS.text,
    fontWeight: '500',
    lineHeight: 22,
  },
  todoTextCompleted: {
    textDecorationLine: 'line-through',
    color: COLORS.textSecondary,
  },
  todoDate: {
    fontSize: 11,
    color: COLORS.textMuted,
    marginTop: 4,
  },
  deleteButton: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    backgroundColor: COLORS.danger + '15',
    marginLeft: 10,
  },
  deleteIcon: {
    fontSize: 20,
    color: COLORS.danger,
    fontWeight: '400',
    marginTop: -1,
  },

  // Empty State
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyEmoji: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 15,
    color: COLORS.textSecondary,
  },
});
