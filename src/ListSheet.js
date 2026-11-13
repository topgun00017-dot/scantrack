// Create or edit a list: name, icon and colour.
import React, { useEffect, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { Icon } from './icons';
import { LIST_COLORS, LIST_ICONS, colors } from './theme';
import { useStore } from './store';
import { PillButton, Sheet, showDialog } from './ui';

export default function ListSheet({ visible, list, onClose, onDeleted }) {
  const { lists, tasks, addList, updateList, deleteList } = useStore();
  const [name, setName] = useState('');
  const [icon, setIcon] = useState(LIST_ICONS[0]);
  const [color, setColor] = useState(LIST_COLORS[0]);
  const isNew = !list;

  useEffect(() => {
    if (!visible) return;
    setName(list?.name || '');
    setIcon(list?.icon || LIST_ICONS[(lists.length * 3) % LIST_ICONS.length]);
    setColor(list?.color || LIST_COLORS[lists.length % LIST_COLORS.length]);
  }, [visible, list]);

  const save = () => {
    const clean = name.replace(/\s+/g, ' ').trim();
    if (!clean) return showDialog('Name the list', 'Type a name, for example "Groceries".');
    if (lists.some((l) => l.id !== list?.id && l.name.toLowerCase() === clean.toLowerCase())) return showDialog('Name taken', `You already have a list called "${clean}".`);
    if (isNew) addList({ name: clean, icon, color });
    else updateList(list.id, { name: clean, icon, color });
    onClose();
  };
  const remove = () => {
    const n = tasks.filter((t) => t.listId === list.id).length;
    showDialog('Delete list?', n ? `Its ${n} task${n > 1 ? 's' : ''} will move to Inbox.` : 'This list is empty.', [
      { text: 'Cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          deleteList(list.id);
          onClose();
          onDeleted && onDeleted();
        },
      },
    ]);
  };

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title={isNew ? 'New list' : 'Edit list'}
      footer={
        <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 12, paddingTop: 8 }}>
          {!isNew && !list.system && (
            <Pressable onPress={remove} style={{ width: 46, height: 46, borderRadius: 23, backgroundColor: '#FDECEC', alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="trash" size={20} color={colors.danger} />
            </Pressable>
          )}
          <PillButton title={isNew ? 'Create list' : 'Save'} onPress={save} />
        </View>
      }
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginVertical: 8 }}>
        <View style={{ width: 46, height: 46, borderRadius: 14, backgroundColor: color + '1F', alignItems: 'center', justifyContent: 'center' }}>
          <Icon name={icon} size={24} color={color} />
        </View>
        <TextInput
          value={name}
          onChangeText={setName}
          editable={!list?.system}
          placeholder="List name"
          placeholderTextColor={colors.faint}
          autoFocus={isNew}
          maxLength={30}
          style={{ flex: 1, fontSize: 19, fontWeight: '500', color: colors.text, paddingVertical: 8 }}
        />
      </View>

      <Text style={{ fontSize: 13, color: colors.sub, marginTop: 14, marginBottom: 10 }}>Colour</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
        {LIST_COLORS.map((c) => (
          <Pressable key={c} onPress={() => setColor(c)} style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: c, alignItems: 'center', justifyContent: 'center', borderWidth: color === c ? 3 : 0, borderColor: '#fff', outlineColor: c }}>
            {color === c && <Icon name="check" size={16} color="#fff" strokeWidth={3} />}
          </Pressable>
        ))}
      </View>

      <Text style={{ fontSize: 13, color: colors.sub, marginTop: 20, marginBottom: 10 }}>Icon</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
        {LIST_ICONS.map((i) => (
          <Pressable key={i} onPress={() => setIcon(i)} style={{ width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: icon === i ? color + '22' : '#F4F4F6', borderWidth: icon === i ? 1.5 : 0, borderColor: color }}>
            <Icon name={i} size={20} color={icon === i ? color : colors.sub} />
          </Pressable>
        ))}
      </View>
      <View style={{ height: 12 }} />
    </Sheet>
  );
}
