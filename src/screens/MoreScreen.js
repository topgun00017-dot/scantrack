import { Icon } from '../icons';
import React from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useStore } from '../store';
import { Card, Header, s } from '../components';
import { colors } from '../theme';
import { findIssues } from '../utils';

export default function MoreScreen({ nav }) {
  const { reports, receipts } = useStore();
  const issues = findIssues(receipts).filter((i) => i.type !== 'no_image').length;
  const items = [
    { icon: 'sparkles', title: 'Assistant', text: 'Ask AI to find, tag, categorise and check your receipts', go: 'agent' },
    { icon: 'file-text', title: 'Expense reports', text: `Professional PDF reports in one tap · ${reports.length} saved`, go: 'reports' },
    { icon: 'download', title: 'Export data', text: 'CSV, PDF, Excel or ZIP — your way', go: 'export' },
    { icon: 'calculator', title: 'Prepare for accounting', text: issues ? `${issues} item(s) to tidy, then hand off to your accountant` : 'Clean records ready for your accountant', go: 'accounting' },
    { icon: 'settings', title: 'Settings', text: 'Profile, currency, accountant, AI key', go: 'settings' },
  ];
  return (
    <ScrollView>
      <Header title="More" />
      <View style={{ paddingHorizontal: 16, gap: 10 }}>
        {items.map((i) => (
          <Card key={i.go} onPress={() => nav.push(i.go)} style={{ flexDirection: 'row', alignItems: 'center' }}>
            <View style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: colors.accent + '26', alignItems: 'center', justifyContent: 'center', marginRight: 14 }}><Icon name={i.icon} size={22} color={colors.accentInk} /></View>
            <View style={{ flex: 1 }}>
              <Text style={s.h2}>{i.title}</Text>
              <Text style={[s.sub, { marginTop: 2 }]}>{i.text}</Text>
            </View>
            <Icon name="chevron-right" size={20} color={colors.faint} />
          </Card>
        ))}
      </View>
    </ScrollView>
  );
}
