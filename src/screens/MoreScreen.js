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
    { icon: '🍩', title: 'Spending breakdown', text: 'Donut chart of spending by category, by month or year', go: 'insights' },
    { icon: '📄', title: 'Expense reports', text: `Professional PDF reports in one tap · ${reports.length} saved`, go: 'reports' },
    { icon: '⬇️', title: 'Export data', text: 'CSV, PDF, Excel or ZIP — your way', go: 'export' },
    { icon: '🧮', title: 'Prepare for accounting', text: issues ? `${issues} item(s) to tidy, then hand off to your accountant` : 'Clean records ready for your accountant', go: 'accounting' },
    { icon: '⚙️', title: 'Settings', text: 'Profile, currency, accountant, AI key', go: 'settings' },
  ];
  return (
    <ScrollView>
      <Header title="More" />
      <View style={{ paddingHorizontal: 16, gap: 10 }}>
        {items.map((i) => (
          <Card key={i.go} onPress={() => nav.push(i.go)} style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Text style={{ fontSize: 28, marginRight: 14 }}>{i.icon}</Text>
            <View style={{ flex: 1 }}>
              <Text style={s.h2}>{i.title}</Text>
              <Text style={[s.sub, { marginTop: 2 }]}>{i.text}</Text>
            </View>
            <Text style={{ color: colors.faint, fontSize: 22 }}>›</Text>
          </Card>
        ))}
      </View>
    </ScrollView>
  );
}
